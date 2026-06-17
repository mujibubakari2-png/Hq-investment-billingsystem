import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService, sanitizeMikroTikName } from "@/lib/mikrotik";
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
        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const lookupDb = getTenantClient(null);
        const router = await lookupDb.router.findUnique({
            where: { id: routerId },
            select: { id: true, tenantId: true },
        });
        if (!router) {
            return errorResponse("Router not found", 404);
        }
        if (!router.tenantId) {
            return errorResponse("Invalid router configuration", 400);
        }

        const db = getTenantClient(router.tenantId);

        const voucher = await db.voucher.findFirst({
            where: {
                code,
                status: "UNUSED",
                OR: [
                    { routerId: null },
                    { routerId },
                ],
            },
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
            client = await db.client.findFirst({
                where: {
                    tenantId: pkg.tenantId,
                    macAddress,
                    subscriptions: {
                        some: {
                            status: "ACTIVE",
                            expiresAt: { gt: new Date() }
                        }
                    }
                },
            });
        }

        if (!client) {
            // Create a temporary client for the voucher
            const username = sanitizeMikroTikName(`V-${code}`);
            client = await db.client.create({
                data: {
                    username,
                    fullName: `Voucher User (${code})`,
                    phone: "0000000000",
                    serviceType: "HOTSPOT",
                    status: "ACTIVE",
                    macAddress: macAddress || null,
                    tenantId: pkg.tenantId,
                },
            });
        }

        // Update voucher status and subscription in a transaction
        const [updatedVoucher, newSub, updatedClient] = await db.$transaction([
            // 1. Mark voucher as USED
            db.voucher.update({
                where: { id: voucher.id },
                data: {
                    status: "USED",
                    usedBy: client.username,
                    usedAt: now,
                },
            }),
            // 2. Create subscription
            db.subscription.create({
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
                    tenantId: pkg.tenantId,
                },
            }),
            // 3. Update client
            db.client.update({
                where: { id: client.id },
                data: { status: "ACTIVE" },
            }),
        ]);

        // 4. SYNC TO RADIUS (Crucial for fast connection when RADIUS is enabled on router)
        try {
            const upUnit = pkg.uploadUnit?.charAt(0)?.toUpperCase() || "M";
            const downUnit = pkg.downloadUnit?.charAt(0)?.toUpperCase() || "M";
            const rateLimit = `${pkg.uploadSpeed}${upUnit}/${pkg.downloadSpeed}${downUnit}`;

            await syncRadiusUser({
                username: client.username,
                password: code,
                tenantId: pkg.tenantId || null,
                fullName: client.fullName || undefined,
                expiresAt: expiresAt,
                status: "Active",
                rateLimit: rateLimit,
                profileName: pkg.name
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
                await db.routerLog.create({
                    data: {
                        routerId: rId,
                        action: "HOTSPOT_VOUCHER_REDEEMED",
                        details: `Voucher redeemed: ${code} | MAC: ${macAddress || "N/A"}`,
                        status: "success",
                        username: client.username,
                        tenantId: pkg.tenantId,
                    },
                });
            } catch (logErr: any) {
                console.error("Router/MikroTik voucher redeem error:", logErr);
                finalSyncStatus = "FAILED_SYNC";
                // ... log error
            }

            if (newSub?.id) {
                await db.subscription.update({
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
