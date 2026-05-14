import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";

/**
 * POST /api/hotspot/callback
 * 
 * Payment provider callback (webhook) for hotspot purchases.
 * When a mobile money payment is confirmed, this:
 * 1. Finds the transaction by reference
 * 2. Marks it as COMPLETED
 * 3. Creates a subscription
 * 4. Creates the hotspot user on the MikroTik router
 * 5. The client can then auto-connect
 */
export async function POST(req: NextRequest) {
    try {
        const webhookSecret =
            process.env.HOTSPOT_WEBHOOK_SECRET ||
            process.env.ZENOPAY_WEBHOOK_SECRET ||
            process.env.HARAKAPAY_WEBHOOK_SECRET ||
            process.env.MPESA_WEBHOOK_SECRET ||
            process.env.PAYMENT_WEBHOOK_SECRET;

        // Only enforce secret validation if a secret is actually configured
        if (webhookSecret) {
            const providedSecret = req.headers.get("x-webhook-secret");
            if (providedSecret !== webhookSecret) {
                return errorResponse("Unauthorized webhook", 401);
            }
        } else {
            // No secret configured: allow but warn — set HOTSPOT_WEBHOOK_SECRET in .env
            console.warn("[HOTSPOT CALLBACK] ⚠️ No webhook secret configured. Set HOTSPOT_WEBHOOK_SECRET in .env to secure this endpoint.")
        }

        const body = await req.json();

        // Standard payment callback fields
        const {
            AccountReference,   // Our transaction reference (HP-XXXXX)
            TransactionId,      // Payment provider's transaction ID
            Amount,
            ResultCode,         // "0" for success
            ResultDesc,
            PhoneNumber,
        } = body;
        if (!AccountReference) {
            return errorResponse("Missing payment reference", 400);
        }

        console.log("📥 Hotspot payment callback:", { AccountReference, TransactionId, ResultCode, ResultDesc });

        // Handle failed payments
        if (ResultCode !== "0" && ResultCode !== 0) {
            // Update transaction to FAILED
            const failedTx = await prisma.transaction.findFirst({
                where: { reference: AccountReference },
            });
            if (failedTx) {
                await prisma.transaction.update({
                    where: { id: failedTx.id },
                    data: { status: "FAILED" },
                });
            }
            return jsonResponse({ message: "Payment failure acknowledged" });
        }

        // Find the transaction
        const transaction = await prisma.transaction.findFirst({
            where: { reference: AccountReference },
            include: { client: true },
        });

        if (!transaction) {
            console.error("Transaction not found for reference:", AccountReference);
            return errorResponse("Transaction not found", 404);
        }

        if (transaction.status === "COMPLETED") {
            return jsonResponse({ message: "Already processed" });
        }

        // Find the package by planName
        const pkg = await prisma.package.findFirst({
            where: { name: transaction.planName || "" },
        });

        if (!pkg) {
            console.error("Package not found:", transaction.planName);
            return errorResponse("Package not found", 404);
        }

        // Calculate expiry date
        const now = new Date();
        const expiresAt = new Date(now);

        switch (pkg.durationUnit) {
            case "MINUTES":
                expiresAt.setMinutes(expiresAt.getMinutes() + pkg.duration);
                break;
            case "HOURS":
                expiresAt.setHours(expiresAt.getHours() + pkg.duration);
                break;
            case "DAYS":
                expiresAt.setDate(expiresAt.getDate() + pkg.duration);
                break;
            case "MONTHS":
                expiresAt.setMonth(expiresAt.getMonth() + pkg.duration);
                break;
        }

        // Complete the purchase in a transaction
        const [updatedTx, newSub] = await prisma.$transaction(async (tx) => {
            // 1. Update transaction
            const utx = await tx.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: "COMPLETED",
                    expiryDate: expiresAt,
                },
            });

            // 2. Create subscription
            const sub = await tx.subscription.create({
                data: {
                    clientId: transaction.clientId,
                    packageId: pkg.id,
                    routerId: pkg.routerId || undefined,
                    status: "ACTIVE",
                    method: "MOBILE",
                    activatedAt: now,
                    expiresAt,
                    onlineStatus: "ONLINE",
                    syncStatus: "PENDING",
                    tenantId: pkg.tenantId,
                },
            });

            // 3. Update client status
            await tx.client.update({
                where: { id: transaction.clientId },
                data: { status: "ACTIVE" },
            });

            return [utx, sub];
        });

        // 4. Sync to RADIUS — CRITICAL: must happen before MikroTik activation
        //    so FreeRADIUS can authenticate the user immediately.
        try {
            const client = transaction.client;
            let rateLimit: string | undefined;
            if (pkg.uploadSpeed && pkg.downloadSpeed) {
                const ulUnit = pkg.uploadUnit === "Mbps" ? "M" : "k";
                const dlUnit = pkg.downloadUnit === "Mbps" ? "M" : "k";
                rateLimit = `${pkg.uploadSpeed}${ulUnit}/${pkg.downloadSpeed}${dlUnit}`;
            }
            await syncRadiusUser({
                username: client.username,
                password: client.phone || undefined,
                tenantId: pkg.tenantId || null,
                fullName: client.fullName || undefined,
                expiresAt,
                status: "Active",
                rateLimit,
                profileName: pkg.name,
            });
        } catch (radErr: any) {
            console.error("[RADIUS] sync error in callback:", radErr);
            // Non-blocking: continue even if RADIUS sync fails
        }

        // 5. Log the hotspot activation on the router and create/enable mikrotik user
        let finalSyncStatus = "PENDING";
        if (pkg.routerId) {
            try {
                const mikrotik = await getMikroTikService(pkg.routerId);
                const userPassword = transaction.client.phone || "123456";
                await mikrotik.activateService(transaction.client.username, userPassword, pkg.name, "hotspot");

                finalSyncStatus = "SYNCED";
                await prisma.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        action: "HOTSPOT_USER_ACTIVATED",
                        details: `Payment confirmed: ${AccountReference} | ${TransactionId || "N/A"} | ${PhoneNumber || "N/A"} | TSH ${Amount}`,
                        status: "success",
                        username: transaction.client.username,
                        tenantId: pkg.tenantId,
                    },
                });
            } catch (logErr: any) {
                console.error("Router/MikroTik error:", logErr);
                finalSyncStatus = "FAILED_SYNC";
                await prisma.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        action: "HOTSPOT_USER_ACTIVATED_FAILED",
                        details: `Router might be offline: ${logErr?.message || "Unknown"}`,
                        status: "error",
                        username: transaction.client.username,
                    },
                });
            }

            if (newSub?.id) {
                await prisma.subscription.update({
                    where: { id: newSub.id },
                    data: { syncStatus: finalSyncStatus },
                });
            }
        }

        console.log(`✅ Hotspot callback processed: ${AccountReference} → ${pkg.name} (${transaction.client.username})`);

        return jsonResponse({
            message: "Payment processed successfully",
            username: transaction.client.username,
            expiresAt: expiresAt.toISOString(),
        });

    } catch (e) {
        console.error("HOTSPOT CALLBACK ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
