import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";

/**
 * POST /api/hotspot/voucher/redeem
 * 
 * Called from the MikroTik hotspot login page when a client enters a voucher code.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { code, macAddress, routerId } = body;

        if (!code) {
            return errorResponse("Voucher code is required", 400);
        }

        // Find the voucher
        const voucher = await prisma.voucher.findUnique({
            where: { code },
            include: { package: true },
        });

        if (!voucher) {
            return errorResponse("Invalid voucher code", 404);
        }

        if (voucher.status !== "UNUSED") {
            return errorResponse(`Voucher is already ${voucher.status.toLowerCase()}`, 400);
        }

        // Validate router if voucher is locked to a router
        if (voucher.routerId && routerId && voucher.routerId !== routerId) {
             return errorResponse("This voucher is not valid for this router", 400);
        }

        const pkg = voucher.package;
        const now = new Date();
        const expiresAt = new Date(now);

        // Calculate expiration based on package duration
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

        // Find or create client by MAC address
        let client = null;
        if (macAddress) {
            client = await prisma.client.findFirst({
                where: { macAddress },
            });
        }

        if (!client) {
            // Create a temporary client for the voucher
            const username = `V-${code}`;
            client = await prisma.client.create({
                data: {
                    username,
                    fullName: `Voucher User (${code})`,
                    phone: "0000000000",
                    serviceType: "HOTSPOT",
                    status: "ACTIVE",
                    macAddress: macAddress || null,
                },
            });
        }

        // Update voucher status and subscription in a transaction
        const [updatedVoucher, newSub, updatedClient] = await prisma.$transaction([
            // 1. Mark voucher as USED
            prisma.voucher.update({
                where: { id: voucher.id },
                data: {
                    status: "USED",
                    usedBy: client.username,
                    usedAt: now,
                },
            }),
            // 2. Create subscription
            prisma.subscription.create({
                data: {
                    clientId: client.id,
                    packageId: pkg.id,
                    routerId: routerId || pkg.routerId || undefined,
                    status: "ACTIVE",
                    method: "VOUCHER",
                    activatedAt: now,
                    expiresAt,
                    onlineStatus: "ONLINE",
                    syncStatus: "PENDING",
                },
            }),
            // 3. Update client
            prisma.client.update({
                where: { id: client.id },
                data: { status: "ACTIVE" },
            }),
        ]);

        // 4. SYNC TO RADIUS (Crucial for fast connection when RADIUS is enabled on router)
        try {
            await syncRadiusUser({
                username: client.username,
                password: code,
                tenantId: pkg.tenantId || null,
                fullName: client.fullName,
                expiresAt: expiresAt,
                status: "Active"
            });
        } catch (radErr) {
            console.error("RADIUS sync error for voucher:", radErr);
            // We continue anyway as local MikroTik sync might still work
        }

        // 5. Activate the user on MikroTik (as backup and for local management)
        const rId = routerId || pkg.routerId;
        let finalSyncStatus = "PENDING";
        if (rId) {
            try {
                const mikrotik = await getMikroTikService(rId);
                // We call this but don't necessarily need to block the response for too long
                // However, for vouchers, it's safer to ensure it's done.
                await mikrotik.activateService(client.username, code, pkg.name, "hotspot", expiresAt);

                finalSyncStatus = "SYNCED";
                await prisma.routerLog.create({
                    data: {
                        routerId: rId,
                        action: "HOTSPOT_VOUCHER_REDEEMED",
                        details: `Voucher redeemed: ${code} | MAC: ${macAddress || "N/A"}`,
                        status: "success",
                        username: client.username,
                    },
                });
            } catch (logErr: any) {
                console.error("Router/MikroTik voucher redeem error:", logErr);
                finalSyncStatus = "FAILED_SYNC";
                // ... log error
            }

            if (newSub?.id) {
                await prisma.subscription.update({
                    where: { id: newSub.id },
                    data: { syncStatus: finalSyncStatus }
                });
            }
        }

        return jsonResponse({
            success: true,
            message: "Voucher redeemed successfully!",
            username: client.username,
            password: code, // Vouchers usually don't have passwords in this flow, or it's the code itself
            expiresAt: expiresAt.toISOString(),
        });

    } catch (e) {
        console.error("VOUCHER REDEEM ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
