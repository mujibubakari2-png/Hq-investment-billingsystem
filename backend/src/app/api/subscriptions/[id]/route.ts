import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { parseOptionalDate } from "@/lib/dateUtils";
import { SubscriptionUpdateSchema } from "@/lib/validators";
import { buildRadiusRateLimit } from "@/lib/hotspotFlow-helpers";
import { enqueueRadiusSyncUser, enqueueRadiusSuspendUser } from "@/lib/radius-queue";
import { enqueueActivateService, enqueueSuspendService } from "@/lib/queue";
import logger from "@/lib/logger";

// GET /api/subscriptions/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "subscriptions:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const sub = await db.subscription.findUnique({
            where: { id },
            include: { client: true, package: true, router: true },
        });
        if (!sub) return errorResponse("Subscription not found", 404);
        if (!canAccessTenant(userPayload, sub.tenantId)) return errorResponse("Forbidden", 403);
        return jsonResponse(sub);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/subscriptions/[id] - edit plan / extend
//
// RADIUS-SYNC-002: Previously this route only wrote to the `subscriptions`
// table. RADIUS (radcheck/radreply) — the actual source of truth MikroTik
// asks on every login — was never told about the change. Consequences that
// were happening silently before this fix:
//   - Admin extends expiresAt (manual renewal) -> RADIUS Expiration/Session-
//     Timeout stayed at the OLD value -> customer got disconnected/rejected
//     at the time they were originally due to expire, despite having paid.
//   - Admin changes packageId (upgrade/downgrade) -> Mikrotik-Rate-Limit/
//     Mikrotik-Group in radreply stayed on the OLD package -> customer kept
//     the old speed indefinitely.
//   - Admin sets status=SUSPENDED -> RADIUS was never suspended -> the
//     customer kept full internet access; MikroTik never even asks the app,
//     only RADIUS, so an app-only "suspend" did nothing on the network.
// Now every field that affects RADIUS truth (status, packageId, expiresAt)
// re-syncs RADIUS (and, for suspend, forces the active session off) in the
// same request, same as the automated payment-webhook renewal path already
// does in lib/payments/service.ts.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "subscriptions:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const parsed = SubscriptionUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data;

        const existing = await db.subscription.findUnique({
            where: { id },
            include: { client: true, package: true },
        });
        if (!existing || !canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Subscription not found", 404);

        const data: any = {};
        if (update.packageId) data.packageId = update.packageId;
        if (update.routerId !== undefined) data.routerId = update.routerId || null;
        if (update.expiresAt !== undefined) { const pd = parseOptionalDate(update.expiresAt as any); if (pd) data.expiresAt = pd; }
        if (update.activatedAt !== undefined) { const pd = parseOptionalDate(update.activatedAt as any); if (pd) data.activatedAt = pd; }
        if (update.status) data.status = update.status;
        if (update.method) data.method = update.method;

        const radiusRelevantChange =
            (update.status && update.status !== existing.status) ||
            (update.packageId && update.packageId !== existing.packageId) ||
            data.expiresAt !== undefined;

        const sub = await db.subscription.update({ where: { id }, data, include: { client: true, package: true, router: true } });

        // ── RADIUS-SYNC-002: re-sync RADIUS so it matches whatever the admin just changed ──
        if (radiusRelevantChange) {
            const username = sub.client.username;
            const tenantId = sub.tenantId ?? null;

            try {
                if (sub.status === "SUSPENDED" || sub.status === "EXPIRED") {
                    // Block the next Access-Request AND kick the current session now,
                    // instead of leaving them connected until the old expiry hits.
                    await enqueueRadiusSuspendUser(username, tenantId, `sub-update-suspend-${sub.id}-${Date.now()}`);
                    if (sub.routerId) {
                        await enqueueSuspendService(sub.routerId, username, sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe", tenantId);
                    }
                } else if (sub.status === "ACTIVE" || sub.status === "EXTENDED") {
                    const rateLimit = buildRadiusRateLimit({
                        uploadSpeed: sub.package.uploadSpeed,
                        uploadUnit: sub.package.uploadUnit,
                        downloadSpeed: sub.package.downloadSpeed,
                        downloadUnit: sub.package.downloadUnit,
                    });
                    await enqueueRadiusSyncUser(
                        {
                            username,
                            password: sub.client.phone || username,
                            tenantId,
                            fullName: sub.client.fullName || undefined,
                            expiresAt: sub.expiresAt,
                            status: "Active",
                            rateLimit,
                            profileName: sub.package.name,
                        },
                        `sub-update-sync-${sub.id}-${Date.now()}`
                    );
                    if (sub.routerId) {
                        await enqueueActivateService(
                            sub.routerId,
                            username,
                            sub.client.phone || "123456",
                            sub.package.name,
                            sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe",
                            tenantId,
                            sub.expiresAt
                        );
                    }
                }
            } catch (syncErr) {
                // Don't fail the admin's edit if the queue is down — but make sure it's
                // visible that RADIUS is now out of sync so it can be retried/investigated.
                logger.error("[SUBSCRIPTION UPDATE] Failed to re-sync RADIUS after edit", {
                    subscriptionId: sub.id,
                    username,
                    error: syncErr instanceof Error ? syncErr.message : String(syncErr),
                });
                await db.subscription.update({ where: { id: sub.id }, data: { syncStatus: "PENDING_RADIUS_SYNC" } }).catch(() => {});
            }
        }

        return jsonResponse(sub);
    } catch (e) {
        logger.error("SUBSCRIPTION UPDATE ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/subscriptions/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "subscriptions:delete");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const existing = await db.subscription.findUnique({ where: { id }, include: { client: true } });
        if (!existing) return errorResponse("Subscription not found", 404);

        if (userPayload.role === "VIEWER") return errorResponse("Forbidden", 403);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);

        // RADIUS-SYNC-002: deleting the subscription record must also revoke the
        // customer's actual network access — otherwise RADIUS keeps granting them
        // Access-Accept forever even though the app has no record of them anymore.
        if (existing.status === "ACTIVE" || existing.status === "EXTENDED") {
            try {
                await enqueueRadiusSuspendUser(existing.client.username, existing.tenantId ?? null, `sub-delete-${existing.id}`);
                if (existing.routerId) {
                    await enqueueSuspendService(existing.routerId, existing.client.username, existing.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe", existing.tenantId ?? null);
                }
            } catch (syncErr) {
                logger.error("[SUBSCRIPTION DELETE] Failed to suspend RADIUS on delete", {
                    subscriptionId: existing.id,
                    error: syncErr instanceof Error ? syncErr.message : String(syncErr),
                });
            }
        }

        await db.subscription.delete({ where: { id } });
        return jsonResponse({ message: "Subscription deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
