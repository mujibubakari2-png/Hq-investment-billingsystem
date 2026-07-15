import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { ClientUpdateSchema } from "@/lib/validators";
import { buildRadiusRateLimit } from "@/lib/hotspotFlow-helpers";
import { enqueueRadiusSyncUser, enqueueRadiusSuspendUser } from "@/lib/radius-queue";
import { enqueueActivateService, enqueueSuspendService } from "@/lib/queue";
import logger from "@/lib/logger";

// GET /api/clients/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "clients:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const client = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId },
            include: {
                subscriptions: {
                    include: { package: true, router: true },
                    orderBy: { createdAt: "desc" },
                },
                transactions: { orderBy: { createdAt: "desc" }, take: 20 },
                invoices: { orderBy: { createdAt: "desc" }, take: 10 },
            },
        });

        if (!client) return errorResponse("Client not found", 404);
        return jsonResponse(client);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

const BLOCKING_STATUSES = new Set(["SUSPENDED", "BANNED", "DISABLED"]);

// PUT /api/clients/[id]
//
// RADIUS-SYNC-003: This is the route the "suspend / ban / disable customer"
// button in the admin UI actually calls (it edits Client.status, not
// Subscription.status). Previously it only wrote the new status to the
// clients table — RADIUS (radcheck/radreply), which is what MikroTik
// actually asks, was never told. An admin could mark a customer
// SUSPENDED/BANNED here and that customer would keep full, unrestricted
// internet access, because MikroTik never consults the app — only RADIUS.
// Same gap, same fix pattern as RADIUS-SYNC-002 in subscriptions/[id].
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "clients:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();
        const parsed = ClientUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data;

        const clientExists = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId },
            include: {
                subscriptions: {
                    include: { package: true },
                    orderBy: { activatedAt: "desc" },
                    take: 1,
                },
            },
        });

        if (!clientExists) return errorResponse("Client not found", 404);

        const dataToUpdate: any = {};
        if (update.username) dataToUpdate.username = update.username;
        if (update.fullName) dataToUpdate.fullName = update.fullName;
        if (update.phone) dataToUpdate.phone = update.phone;
        if (update.email) dataToUpdate.email = update.email;
        if (update.serviceType) dataToUpdate.serviceType = update.serviceType;
        if (update.accountType) dataToUpdate.accountType = update.accountType;
        if (update.status) dataToUpdate.status = update.status?.toUpperCase();
        if (update.macAddress) dataToUpdate.macAddress = update.macAddress;
        if (update.device) dataToUpdate.device = update.device;

        // Include tenantId in WHERE clause — prevents TOCTOU race where
        // the pre-check passes but the record belongs to a different tenant by update time.
        const client = await db.client.update({ where: { id, tenantId: userPayload.tenantId! }, data: dataToUpdate });

        // ── RADIUS-SYNC-003: keep RADIUS (and the linked subscription) in step ──
        const newStatus = dataToUpdate.status as string | undefined;
        const latestSub = clientExists.subscriptions[0];
        if (newStatus && newStatus !== clientExists.status) {
            const tenantId = client.tenantId ?? null;
            try {
                if (BLOCKING_STATUSES.has(newStatus)) {
                    await enqueueRadiusSuspendUser(client.username, tenantId, `client-update-suspend-${client.id}-${Date.now()}`);
                    if (latestSub?.routerId) {
                        await enqueueSuspendService(latestSub.routerId, client.username, client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe", tenantId);
                    }
                    if (latestSub && (latestSub.status === "ACTIVE" || latestSub.status === "EXTENDED")) {
                        await db.subscription.update({ where: { id: latestSub.id }, data: { status: "SUSPENDED", onlineStatus: "OFFLINE" } }).catch(() => {});
                    }
                } else if (newStatus === "ACTIVE" && BLOCKING_STATUSES.has(clientExists.status)) {
                    // Reactivation: only meaningful if there's an unexpired subscription to restore.
                    if (latestSub && latestSub.package && latestSub.expiresAt > new Date()) {
                        const rateLimit = buildRadiusRateLimit({
                            uploadSpeed: latestSub.package.uploadSpeed,
                            uploadUnit: latestSub.package.uploadUnit,
                            downloadSpeed: latestSub.package.downloadSpeed,
                            downloadUnit: latestSub.package.downloadUnit,
                        });
                        await enqueueRadiusSyncUser(
                            {
                                username: client.username,
                                password: client.phone || client.username,
                                tenantId,
                                fullName: client.fullName || undefined,
                                expiresAt: latestSub.expiresAt,
                                status: "Active",
                                rateLimit,
                                profileName: latestSub.package.name,
                            },
                            `client-update-reactivate-${client.id}-${Date.now()}`
                        );
                        if (latestSub.routerId) {
                            await enqueueActivateService(
                                latestSub.routerId,
                                client.username,
                                client.phone || "123456",
                                latestSub.package.name,
                                client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe",
                                tenantId,
                                latestSub.expiresAt
                            );
                        }
                        await db.subscription.update({ where: { id: latestSub.id }, data: { status: "ACTIVE" } }).catch(() => {});
                    }
                }
            } catch (syncErr) {
                logger.error("[CLIENT UPDATE] Failed to re-sync RADIUS after status change", {
                    clientId: client.id,
                    username: client.username,
                    newStatus,
                    error: syncErr instanceof Error ? syncErr.message : String(syncErr),
                });
            }
        }

        return jsonResponse(client);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/clients/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "clients:delete");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;

        const clientExists = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId },
            include: { subscriptions: { where: { status: { in: ["ACTIVE", "EXTENDED"] } }, take: 1 } },
        });
        if (!clientExists) return errorResponse("Client not found", 404);

        // RADIUS-SYNC-003: deleting a client must also revoke their RADIUS access —
        // otherwise a "deleted" customer can still authenticate and get online.
        const activeSub = clientExists.subscriptions[0];
        if (activeSub) {
            try {
                await enqueueRadiusSuspendUser(clientExists.username, clientExists.tenantId ?? null, `client-delete-${clientExists.id}`);
                if (activeSub.routerId) {
                    await enqueueSuspendService(activeSub.routerId, clientExists.username, clientExists.serviceType === "HOTSPOT" ? "hotspot" : "pppoe", clientExists.tenantId ?? null);
                }
            } catch (syncErr) {
                logger.error("[CLIENT DELETE] Failed to suspend RADIUS on delete", {
                    clientId: clientExists.id,
                    error: syncErr instanceof Error ? syncErr.message : String(syncErr),
                });
            }
        }

        await db.client.delete({ where: { id } });
        return jsonResponse({ message: "Client deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
