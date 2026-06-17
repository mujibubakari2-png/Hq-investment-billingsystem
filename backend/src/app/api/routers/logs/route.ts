import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getTenantFilter } from "@/lib/tenant";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

// GET /api/routers/logs — List all router action logs
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const url = new URL(req.url);
        const routerId = url.searchParams.get("routerId");
        const action = url.searchParams.get("action");
        const status = url.searchParams.get("status");
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const page = parseInt(url.searchParams.get("page") || "1");

        const where: any = { ...tenantFilter };
        if (routerId) where.routerId = routerId;
        if (action) where.action = { contains: action };
        if (status) where.status = status;

        const [logs, total] = await Promise.all([
            db.routerLog.findMany({
                where,
                include: { router: { select: { name: true, host: true } } },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
            }),
            db.routerLog.count({ where }),
        ]);

        return jsonResponse({
            data: logs.map(l => ({
                id: l.id,
                routerId: l.routerId,
                routerName: l.router.name,
                routerHost: l.router.host,
                action: l.action,
                details: l.details,
                status: l.status,
                username: l.username,
                ipAddress: l.ipAddress,
                createdAt: l.createdAt.toISOString(),
            })),
            total,
            page,
            limit,
        });
    } catch (err: any) {
        console.error(err);
        return errorResponse("Internal server error", 500);
    }
}

