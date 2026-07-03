import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter } from "@/lib/tenant";
import logger from "@/lib/logger";


// GET /api/hotspot - list all hotspot subscribers for the tenant
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "subscriptions:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const routerId = searchParams.get("routerId") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Filter for ACTIVE subscriptions with client type HOTSPOT
        const whereCondition: any = {
            status: "ACTIVE",
            client: { serviceType: "HOTSPOT" },
            ...tenantFilter
        };

        if (routerId !== "All") {
            whereCondition.routerId = routerId;
        }

        const subscriptions = await db.subscription.findMany({
            where: whereCondition,
            include: { client: true, package: true, router: true },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        });

        const total = await db.subscription.count({ where: whereCondition });

        // Date helper
        const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

        const mapped = subscriptions.map(s => ({
            id: s.id,
            username: s.client?.username || "Unknown",
            fullName: s.client?.fullName || "Unknown",
            plan: s.package?.name || "N/A",
            price: s.package?.price || 0,
            router: s.router?.name || "N/A",
            macAddress: s.client?.macAddress || "N/A",
            // E20 FIX: Return raw ISO string — frontend handles locale-aware display formatting
            expiresAt: isValidDate(s.expiresAt) ? s.expiresAt!.toISOString() : null,
            online: s.onlineStatus === "ONLINE" ? "Online" : "Offline",
            status: "Active",
            createdAt: s.createdAt
        }));

        if (search) {
            const filtered = mapped.filter(s =>
                s.username.toLowerCase().includes(search) ||
                s.fullName.toLowerCase().includes(search) ||
                s.macAddress.toLowerCase().includes(search)
            );
            return jsonResponse({ data: filtered, total: filtered.length });
        }

        return jsonResponse({
            data: mapped,
            total,
            page,
            limit
        });

    } catch (e) {
        logger.error("Hotspot subscribers GET error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
