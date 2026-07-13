import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter } from "@/lib/tenant";
import { getMikroTikService } from "@/lib/mikrotik";
import { enqueueRadiusSyncUser } from "@/lib/radius-queue";
import { enqueueActivateService } from "@/lib/queue";
import { buildRadiusRateLimit } from "@/lib/hotspotFlow-helpers";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "subscriptions:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const body = await req.json();
        const { subscriptionIds, durationDays = 30 } = body;

        if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
            return errorResponse("Please select at least one expired subscriber to bulk extend.");
        }

        const subs = await db.subscription.findMany({
            where: { id: { in: subscriptionIds }, status: "EXPIRED", ...tenantFilter },
            include: { client: true, package: true, router: true },
        });

        if (subs.length === 0) {
            return errorResponse("No valid expired subscriptions found to extend.");
        }

        const newExpiresDate = new Date();
        newExpiresDate.setDate(newExpiresDate.getDate() + durationDays);

        const successes = [];
        const failures = [];

        for (const sub of subs) {
            try {
                if (!sub.routerId || !sub.client || !sub.package) {
                    throw new Error("Missing critical relations (router, client, package)");
                }

                // Queue activation on MikroTik (async — non-blocking)
                const pwd = sub.client.phone || "123456";
                const type = sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                await enqueueActivateService(
                    sub.routerId,
                    sub.client.username,
                    pwd,
                    sub.package.name,
                    type,
                    sub.tenantId ?? null,
                    newExpiresDate
                );

                // Update database
                await db.subscription.update({
                    where: { id: sub.id },
                    data: {
                        status: "ACTIVE",
                        syncStatus: "PENDING_MIKROTIK_ACTIVATION",
                        expiresAt: newExpiresDate,
                    }
                });

                // Record log
                await db.routerLog.create({
                    data: {
                        routerId: sub.routerId,
                        action: "BULK_EXTEND_QUEUED",
                        details: `Admin bulk extended ${type} plan ${sub.package.name} - activation job queued`,
                        status: "success",
                        username: sub.client.username,
                        tenantId: sub.tenantId,
                    }
                });

                // Sync RADIUS (queued - non-blocking)
                try {
                    const rateLimit = buildRadiusRateLimit({
                        uploadSpeed: sub.package.uploadSpeed,
                        uploadUnit: sub.package.uploadUnit,
                        downloadSpeed: sub.package.downloadSpeed,
                        downloadUnit: sub.package.downloadUnit,
                    });
                    await enqueueRadiusSyncUser({
                        username: sub.client.username,
                        password: sub.client.phone || "123456",
                        tenantId: sub.package.tenantId || null,
                        fullName: sub.client.fullName || undefined,
                        expiresAt: newExpiresDate,
                        status: "Active",
                        profileName: sub.package.name,
                        rateLimit,
                    }, `bulkext-${sub.id}`);
                } catch (queueErr) {
                    logger.error(`Bulk extend RADIUS queue error on ${sub.id}:`, { error: queueErr instanceof Error ? queueErr.message : String(queueErr) });
                }

                successes.push(sub.client.username);
            } catch (err: any) {
                logger.error(`Bulk extend specific error on ${sub.id}:`, { error: err instanceof Error ? err.message : String(err) });
                // Mark DB
                await db.subscription.update({
                    where: { id: sub.id },
                    data: {
                        syncStatus: "FAILED_SYNC"
                    }
                });

                if (sub.routerId && sub.client) {
                    await db.routerLog.create({
                        data: {
                            routerId: sub.routerId,
                            action: "BULK_EXTEND_FAILED",
                            details: `Bulk extend failed: ${err.message}`,
                            status: "error",
                            username: sub.client.username,
                            tenantId: sub.tenantId,
                        }
                    });
                }
                failures.push({ username: sub.client?.username, error: err.message });
            }
        }

        return jsonResponse({
            message: `Bulk extension complete. Success: ${successes.length}, Failed: ${failures.length}`,
            successes,
            failures
        });

    } catch (e) {
        logger.error("Bulk extend generic error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
