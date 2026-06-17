import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toISOSafe } from "@/lib/dateUtils";


export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "subscriptions:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const tenantFilter = { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const type = searchParams.get("type") || "All"; // PPPoE or Hotspot
        const onlineStatus = searchParams.get("onlineStatus") || "All"; // Online or Offline
        const routerId = searchParams.get("routerId") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // ── Real-time RADIUS Online Status Sync ──────────────────────────────────
        // Before returning data, sync onlineStatus from live RADIUS accounting sessions.
        // A subscription is ONLINE if the client's username has an open session
        // in radacct (acctstoptime IS NULL). Otherwise it's OFFLINE.
        try {
            // Get all usernames that currently have an active RADIUS session
            const activeRadiusSessions = await db.radAcct.findMany({
                where: { acctstoptime: null, ...tenantFilter },
                select: { username: true },
                distinct: ["username"],
            });

            const onlineUsernames = new Set(activeRadiusSessions.map((s) => s.username));

            // Fetch all active subscriptions with client info
            const allActiveSubs = await db.subscription.findMany({
                where: { status: "ACTIVE", ...tenantFilter },
                select: {
                    id: true,
                    onlineStatus: true,
                    client: { select: { username: true } },
                },
            });

            const toSetOnline: string[] = [];
            const toSetOffline: string[] = [];

            for (const sub of allActiveSubs as any[]) {
                const username = sub.client?.username;
                if (!username) continue;
                if (onlineUsernames.has(username) && sub.onlineStatus !== "ONLINE") {
                    toSetOnline.push(sub.id);
                } else if (!onlineUsernames.has(username) && sub.onlineStatus !== "OFFLINE") {
                    toSetOffline.push(sub.id);
                }
            }

            // Batch update to avoid N+1 queries
            if (toSetOnline.length > 0) {
                await db.subscription.updateMany({
                    where: { id: { in: toSetOnline } },
                    data: { onlineStatus: "ONLINE" },
                });
            }
            if (toSetOffline.length > 0) {
                await db.subscription.updateMany({
                    where: { id: { in: toSetOffline } },
                    data: { onlineStatus: "OFFLINE" },
                });
            }
        } catch (e) {
            console.error("[ACTIVE SUBSCRIBERS RADIUS SYNC ERROR]:", e);
            // Do NOT block the response — just log and continue with stale data
        }

        // Base filter for ACTIVE status
        const whereCondition: any = { status: "ACTIVE", ...tenantFilter };

        if (routerId !== "All") {
            whereCondition.routerId = routerId;
        }

        // Fetch all active subscriptions after online status sync
        const allActive = await db.subscription.findMany({
            where: whereCondition,
            include: { client: true, package: true, router: true },
            orderBy: { createdAt: "desc" }
        });

        // Map to common UI format
        const allMapped = allActive.map(s => {
            return {
                id: s.id,
                user: s.client?.username || "Unknown",
                username: s.client?.username || "Unknown",
                fullName: s.client?.fullName || "",
                phone: s.client?.phone || "",
                plan: s.package?.name || "N/A",
                type: s.client?.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                device: s.client?.device || "N/A",
                macAddress: s.client?.macAddress || "N/A",
                created: toISOSafe(s.createdAt),
                expires: toISOSafe(s.expiresAt),
                method: s.method || "Manual",
                router: s.router?.name || "N/A",
                routerId: s.routerId || "",
                status: "Active",
                // Real-time online status sourced from RADIUS
                online: s.onlineStatus === "ONLINE" ? "Online" : "Offline",
                sync: s.syncStatus || "Synced",
            };
        });

        // Compute summaries from complete dataset
        const summaries = {
            totalActive: allMapped.length,
            online: allMapped.filter(s => s.online === "Online").length,
            offline: allMapped.filter(s => s.online === "Offline").length,
            pppoe: allMapped.filter(s => s.type === "PPPoE").length,
            hotspot: allMapped.filter(s => s.type === "Hotspot").length,
        };

        // Filter by user search, type tab, and online status tab
        const filtered = allMapped.filter(s => {
            const matchType = type === "All" || s.type === type;
            const matchOnline = onlineStatus === "All" || s.online === onlineStatus;
            const matchSearch = search === "" ||
                s.username.toLowerCase().includes(search) ||
                s.plan.toLowerCase().includes(search) ||
                s.macAddress.toLowerCase().includes(search) ||
                s.fullName.toLowerCase().includes(search);
            return matchType && matchOnline && matchSearch;
        });

        // Paginate
        const total = filtered.length;
        const data = filtered.slice((page - 1) * limit, page * limit);

        return jsonResponse({
            data,
            total,
            summaries,
        });

    } catch (e) {
        console.error("Active subscribers GET error:", e);
        return errorResponse("Internal server error", 500);
    }
}
