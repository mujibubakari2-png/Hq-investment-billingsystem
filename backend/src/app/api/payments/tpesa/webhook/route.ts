import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import crypto from "crypto";

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
        // Apply rate limiting
        const rateLimited = rateLimitMiddleware(req);
        if (rateLimited) {
            return rateLimited;
        }

        // ── Webhook signature verification ──────────────────────────────────
        // T-Pesa webhook secret: prefer the DB-stored tenant channel secret (if available
        // after we find the transaction/tenant), but do a first-pass check with env secret.
        // Full per-tenant verification happens after we identify the tenant below.
        const envWebhookSecret = env.TPESA_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;
        if (!envWebhookSecret) {
            return errorResponse("Webhook secret is not configured", 500);
        }
        const providedSecret = (
            req.headers.get("x-webhook-secret") ||
            req.headers.get("x-tpesa-signature") ||
            ""
        ).toString();
        const providedDigest = crypto.createHash("sha256").update(providedSecret).digest();
        const secretDigest   = crypto.createHash("sha256").update(envWebhookSecret).digest();
        try {
            if (!crypto.timingSafeEqual(providedDigest, secretDigest)) {
                return errorResponse("Unauthorized webhook", 401);
            }
        } catch {
            return errorResponse("Unauthorized webhook", 401);
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

        const globalDb = getTenantClient(null);

        // Handle failed payments
        if (ResultCode !== "0" && ResultCode !== 0) {
            // Update transaction to FAILED if the transaction record exists and has tenant context.
            const failedTx = await globalDb.transaction.findUnique({
                where: { reference: AccountReference },
            });
            if (failedTx) {
                if (!failedTx.tenantId) {
                    console.error("TPESA failed payment record missing tenantId", failedTx.id);
                } else {
                    await globalDb.transaction.update({
                        where: { id: failedTx.id, tenantId: failedTx.tenantId },
                        data: { status: "FAILED" },
                    });
                }
            }
            return jsonResponse({ message: "Payment failure acknowledged" });
        }

        // Find the transaction
        const transaction = await globalDb.transaction.findUnique({
            where: { reference: AccountReference },
            include: { client: true },
        });

        if (!transaction) {
            console.error("Transaction not found for reference:", AccountReference);
            return errorResponse("Transaction not found", 404);
        }

        if (!transaction.tenantId) {
            console.error("Transaction missing tenantId:", transaction.id);
            return errorResponse("Invalid transaction tenant data", 500);
        }

        if (!transaction.client) {
            console.error("Transaction missing client relation:", transaction.id);
            return errorResponse("Invalid transaction client data", 500);
        }

        if (transaction.status === "COMPLETED") {
            return jsonResponse({ message: "Already processed" });
        }

        // ── Re-verify signature using the per-tenant DB channel secret ───────
        // MOD-13 FIX: If the tenant has configured their own webhook secret in the
        // PaymentChannel table, use that for verification. The global env secret is
        // only a fallback for tenants without a DB-configured channel.
        const tenantDb = getTenantClient(transaction.tenantId);
        const { decrypt } = await import("@/lib/encryption");
        const tenantChannel = await tenantDb.paymentChannel.findFirst({
            where: { provider: "TPESA", status: "ACTIVE", tenantId: transaction.tenantId },
        });
        if (tenantChannel?.webhookSecret) {
            const decryptedSecret = decrypt(tenantChannel.webhookSecret);
            if (decryptedSecret) {
                const tenantProvidedDigest = crypto.createHash("sha256").update(providedSecret).digest();
                const tenantSecretDigest   = crypto.createHash("sha256").update(decryptedSecret).digest();
                try {
                    if (!crypto.timingSafeEqual(tenantProvidedDigest, tenantSecretDigest)) {
                        console.error(`[TPESA] Tenant channel secret mismatch for tenant ${transaction.tenantId}`);
                        return errorResponse("Unauthorized webhook", 401);
                    }
                } catch {
                    return errorResponse("Unauthorized webhook", 401);
                }
            }
        }

        // ── Partial payment check (CRITICAL-3 FIX) ───────────────────────────
        // Validate the amount from the callback matches what we stored on the Transaction.
        // Without this check, a successful callback with a lower amount would still activate
        // the hotspot user (free or discounted service attack).
        const callbackAmount = Number(Amount);
        if (!isNaN(callbackAmount) && callbackAmount > 0 && callbackAmount < transaction.amount) {
            console.error(`[TPESA] Partial payment detected: paid=${callbackAmount}, expected=${transaction.amount}, ref=${AccountReference}`);
            // Record the partial payment attempt but do not activate the service
            await tenantDb.transaction.update({
                where: { id: transaction.id, tenantId: transaction.tenantId },
                data: { status: "FAILED" },
            });
            return errorResponse(
                `Partial payment rejected: received ${callbackAmount}, expected ${transaction.amount}`,
                400
            );
        }
        const pkg = transaction.packageId
            ? await tenantDb.package.findFirst({
                where: {
                    id: transaction.packageId,
                    tenantId: transaction.tenantId,
                },
            })
            : await tenantDb.package.findFirst({
                where: {
                    name: transaction.planName || "",
                    tenantId: transaction.tenantId,
                },
            });

        if (!pkg || pkg.tenantId !== transaction.tenantId) {
            console.error("Package not found for transaction tenant", {
                transactionId: transaction.id,
                planName: transaction.planName,
                packageId: transaction.packageId,
                transactionTenantId: transaction.tenantId,
                pkgTenantId: pkg?.tenantId,
            });
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

        // Complete the purchase in a tenant-scoped transaction.
        // Use an atomic conditional update to make this webhook idempotent
        // and safe under concurrent webhook deliveries.
        let updatedTx: any = null;
        let newSub: any = null;
        try {
            [updatedTx, newSub] = await tenantDb.$transaction(async (tx) => {
                // Atomically mark the transaction COMPLETED only if it wasn't already.
                const res = await tx.transaction.updateMany({
                    where: { id: transaction.id, status: { not: 'COMPLETED' } },
                    data: { status: 'COMPLETED', expiryDate: expiresAt },
                });

                if (res.count === 0) {
                    // Another worker already processed this transaction.
                    throw new Error('ALREADY_PROCESSED');
                }

                // Re-read the updated transaction for logging
                const utx = await tx.transaction.findUnique({ where: { id: transaction.id } });

                // Create subscription
                const sub = await tx.subscription.create({
                    data: {
                        clientId: transaction.clientId,
                        packageId: pkg.id,
                        routerId: pkg.routerId || undefined,
                        status: 'ACTIVE',
                        method: 'MOBILE',
                        activatedAt: now,
                        expiresAt,
                        onlineStatus: 'ONLINE',
                        syncStatus: 'PENDING',
                    },
                });

                // Update client status
                await tx.client.update({ where: { id: transaction.clientId }, data: { status: 'ACTIVE' } });

                return [utx, sub];
            });

            // proceed as before with sync/activation...
        } catch (err: any) {
            if (err?.message === 'ALREADY_PROCESSED') {
                return jsonResponse({ message: 'Already processed' });
            }
            throw err;
        }

        // 4. Sync to RADIUS
        try {
            let rateLimit: string | undefined;
            if (pkg.uploadSpeed && pkg.downloadSpeed) {
                const ulUnit = pkg.uploadUnit === "Mbps" ? "M" : "k";
                const dlUnit = pkg.downloadUnit === "Mbps" ? "M" : "k";
                rateLimit = `${pkg.uploadSpeed}${ulUnit}/${pkg.downloadSpeed}${dlUnit}`;
            }
            await syncRadiusUser({
                username: transaction.client.username,
                password: transaction.client.phone || undefined,
                tenantId: pkg.tenantId || null,
                fullName: transaction.client.fullName || undefined,
                expiresAt,
                status: "Active",
                rateLimit,
                profileName: pkg.name,
            });
        } catch (radErr: any) {
            console.error("[RADIUS] T-Pesa webhook sync error:", radErr);
        }

        // 5. Activate on MikroTik router
        let finalSyncStatus = "PENDING";
        if (pkg.routerId) {
            try {
                const mikrotik = await getMikroTikService(pkg.routerId);
                // We use phone number or a default password for the created hotspot user
                const userPassword = transaction.client.phone || "123456";
                await mikrotik.activateService(transaction.client.username, userPassword, pkg.name, "hotspot");

                finalSyncStatus = "SYNCED";
                await tenantDb.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        action: "HOTSPOT_USER_ACTIVATED",
                        details: `Payment confirmed: ${AccountReference} | ${TransactionId || "N/A"} | ${PhoneNumber || "N/A"} | TSH ${Amount}`,
                        status: "success",
                        username: transaction.client.username,
                    },
                });
            } catch (logErr: any) {
                console.error("Router/MikroTik error:", logErr);
                finalSyncStatus = "FAILED_SYNC";
                await tenantDb.routerLog.create({
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
                await tenantDb.subscription.update({
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
