import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter } from "@/lib/tenant";
import { backfillRadiusAccountingTenants } from "@/lib/radiusTenant";

/**
 * POST /api/radius/sync-online
 *
 * Syncs the onlineStatus field on all active subscriptions for the current tenant
 * against live RADIUS accounting sessions in the radacct table.
 *
 * A user is ONLINE if there exists an open radacct row (acctstoptime IS NULL)
 * with their username. Otherwise they are OFFLINE.
 *
 * Returns a summary of how many subscriptions were updated.
 */
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:sync");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const globalDb = getTenantClient(null);

        const { filter: tenantFilter } = getTenantFilter(userPayload);

        await backfillRadiusAccountingTenants(globalDb);

        // 1. Get all unique usernames currently online in RADIUS
        const activeRadiusSessions = await db.radAcct.findMany({
            where: { acctstoptime: null, ...tenantFilter },
            select: { username: true },
            distinct: ["username"],
        });

        const onlineUsernames = new Set(activeRadiusSessions.map((s) => s.username));

        // 2. Fetch all active subscriptions with their client's username
        const activeSubscriptions = await db.subscription.findMany({
            where: { status: "ACTIVE", ...tenantFilter },
            select: { id: true, onlineStatus: true, client: { select: { username: true } } },
        });

        const toSetOnline: string[] = [];
        const toSetOffline: string[] = [];

        for (const sub of activeSubscriptions) {
            const username = sub.client?.username;
            if (!username) continue;

            if (onlineUsernames.has(username) && sub.onlineStatus !== "ONLINE") {
                toSetOnline.push(sub.id);
            } else if (!onlineUsernames.has(username) && sub.onlineStatus !== "OFFLINE") {
                toSetOffline.push(sub.id);
            }
        }

        // 3. Batch update subscriptions
        const [onlineResult, offlineResult] = await Promise.all([
            toSetOnline.length > 0
                ? db.subscription.updateMany({
                    where: { id: { in: toSetOnline } },
                    data: { onlineStatus: "ONLINE" },
                })
                : Promise.resolve({ count: 0 }),
            toSetOffline.length > 0
                ? db.subscription.updateMany({
                    where: { id: { in: toSetOffline } },
                    data: { onlineStatus: "OFFLINE" },
                })
                : Promise.resolve({ count: 0 }),
        ]);

        return jsonResponse({
            success: true,
            message: "RADIUS online status synced successfully",
            summary: {
                totalRadiusOnline: onlineUsernames.size,
                totalActiveSubscriptions: activeSubscriptions.length,
                updatedToOnline: onlineResult.count,
                updatedToOffline: offlineResult.count,
                noChangeNeeded: activeSubscriptions.length - toSetOnline.length - toSetOffline.length,
            },
        });

    } catch (e) {
        console.error("[RADIUS SYNC ONLINE ERROR]:", e);
        return errorResponse("Internal server error", 500);
    }
}

/**
 * GET /api/radius/sync-online
 *
 * Returns current RADIUS online session stats for the tenant without modifying data.
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const globalDb = getTenantClient(null);

        const { filter: tenantFilter } = getTenantFilter(userPayload);

        await backfillRadiusAccountingTenants(globalDb);

        const [activeSessions, totalActive] = await Promise.all([
            db.radAcct.findMany({
                where: { acctstoptime: null, ...tenantFilter },
                select: {
                    username: true,
                    framedprotocol: true,
                    acctstarttime: true,
                    framedipaddress: true,
                    nasipaddress: true,
                    callingstationid: true,
                },
            }),
            db.subscription.count({ where: { status: "ACTIVE", ...tenantFilter } }),
        ]);

        const hotspotOnline = activeSessions.filter(s => s.framedprotocol !== "PPP").length;
        const pppoeOnline = activeSessions.filter(s => s.framedprotocol === "PPP").length;

        return jsonResponse({
            totalOnline: activeSessions.length,
            hotspotOnline,
            pppoeOnline,
            totalActiveSubscriptions: totalActive,
            onlineUsernames: [...new Set(activeSessions.map(s => s.username))],
            sessions: activeSessions.map(s => ({
                username: s.username,
                protocol: s.framedprotocol === "PPP" ? "PPPoE" : "Hotspot",
                startTime: s.acctstarttime
                    ? s.acctstarttime.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam" })
                    : null,
                ipAddress: s.framedipaddress || null,
                nasIp: s.nasipaddress,
                macAddress: s.callingstationid || null,
            })),
        });

    } catch (e) {
        console.error("[RADIUS SYNC ONLINE GET ERROR]:", e);
        return errorResponse("Internal server error", 500);
    }
}

