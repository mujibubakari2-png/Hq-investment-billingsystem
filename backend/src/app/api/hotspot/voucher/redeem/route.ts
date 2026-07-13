import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService, sanitizeMikroTikName } from "@/lib/mikrotik";
import { enqueueRadiusSyncUser } from "@/lib/radius-queue";
import { enqueueActivateService } from "@/lib/queue";
import { buildRadiusRateLimit, calculateExpirationDate } from "@/lib/hotspotFlow-helpers";
import { buildHotspotPortalFeedback } from "@/lib/hotspotFlow";
import logger from "@/lib/logger";

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
            // Create a temporary client for the voucher using a non-revealing username.
            const serviceType = pkg.type === "PPPOE" ? "PPPOE" : "HOTSPOT";
            const usernamePrefix = serviceType === "PPPOE" ? "PE" : "HS";
            const usernameSuffix = sanitizeMikroTikName(voucher.id);
            const username = `${usernamePrefix}-${usernameSuffix}`;

            client = await db.client.create({
                data: {
                    username,
                    fullName: "Voucher User",
                    phone: "0000000000",
                    serviceType,
                    status: "ACTIVE",
                    macAddress: macAddress || null,
                    tenantId: pkg.tenantId,
                },
            });
        }

        // 4. SYNC TO RADIUS (queued - non-blocking)
        // RAD-Q-002 FIX: Moved to async queue, returns 200 immediately
        const rateLimit = buildRadiusRateLimit({
            uploadSpeed: pkg.uploadSpeed,
            uploadUnit: pkg.uploadUnit,
            downloadSpeed: pkg.downloadSpeed,
            downloadUnit: pkg.downloadUnit,
        });

        let radiusSyncQueued = false;
        try {
            await enqueueRadiusSyncUser(
                {
                    username: client.username,
                    password: code,
                    tenantId: pkg.tenantId || null,
                    fullName: client.fullName || undefined,
                    expiresAt: expiresAt,
                    status: "Active",
                    rateLimit: rateLimit,
                    profileName: pkg.name
                },
                `voucher-${voucher.id}` // idempotency key
            );
            radiusSyncQueued = true;
        } catch (queueErr) {
            logger.error("Failed to queue RADIUS sync for voucher:", { error: queueErr instanceof Error ? queueErr.message : String(queueErr) });
            // Continue - will try again via retry logic
        }

        // 5. Activate the user on MikroTik (async via queue — non-blocking)
        const rId = routerId || pkg.routerId;
        let mikrotikQueueSuccess = false;
        let finalSyncStatus = "PENDING";

        if (rId) {
            try {
                await enqueueActivateService(
                    rId,
                    client.username,
                    code,
                    pkg.name,
                    "hotspot",
                    pkg.tenantId ?? null,
                    expiresAt
                );
                mikrotikQueueSuccess = true;
                finalSyncStatus = "PENDING_MIKROTIK_ACTIVATION";

                await db.routerLog.create({
                    data: {
                        routerId: rId,
                        action: "HOTSPOT_VOUCHER_REDEEMED",
                        details: `Voucher redeemed: ${code} | MAC: ${macAddress || "N/A"} - activation job queued`,
                        status: "success",
                        username: client.username,
                        tenantId: pkg.tenantId,
                    },
                });
            } catch (queueErr: any) {
                logger.error("Router/MikroTik voucher queue error:", { error: queueErr instanceof Error ? queueErr.message : String(queueErr) });
                finalSyncStatus = "FAILED_QUEUE";
            }
        } else {
            // If there's no router assigned, we rely entirely on RADIUS (queued).
            // Mark as PENDING if RADIUS queue succeeded; FAILED if queue also failed
            finalSyncStatus = radiusSyncQueued ? "PENDING" : "FAILED_SYNC";
        }

        // 6. Abort if both MikroTik failed AND RADIUS queue failed. The voucher remains UNUSED.
        if (!mikrotikQueueSuccess && !radiusSyncQueued) {
            return errorResponse("Failed to connect to the network router. Your voucher has NOT been used. Please try again.", 500);
        }

        // 7. Update voucher status and subscription in a transaction ONLY after successful network activation
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
                    syncStatus: finalSyncStatus,
                    tenantId: pkg.tenantId,
                },
            }),
            // 3. Update client
            db.client.update({
                where: { id: client.id },
                data: { status: "ACTIVE" },
            }),
        ]);

        const feedback = buildHotspotPortalFeedback({ kind: 'voucher', state: 'success' });

        return jsonResponse({
            success: true,
            title: feedback.title,
            message: feedback.message,
            autoConnect: feedback.autoConnect,
            username: client.username,
            password: code,
            expiresAt: expiresAt.toISOString(),
        });

    } catch (e) {
        logger.error("VOUCHER REDEEM ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
