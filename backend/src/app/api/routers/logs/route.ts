import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/routers/logs — List all router action logs
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

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
            prisma.routerLog.findMany({
                where,
                include: { router: { select: { name: true, host: true } } },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
            }),
            prisma.routerLog.count({ where }),
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
