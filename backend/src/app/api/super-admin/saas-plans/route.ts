import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

/**
 * GET  /api/super-admin/saas-plans    — list all SaaS plans
 * POST /api/super-admin/saas-plans    — create a new SaaS plan
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const plans = await db.saasPlan.findMany({
            orderBy: { price: "asc" },
            include: {
                _count: { select: { tenants: true } },
            },
        });

        return jsonResponse({
            data: plans.map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                pppoeLimit: p.pppoeLimit,
                hotspotLimit: p.hotspotLimit,
                maxRouters: p.maxRouters,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
                tenantCount: p._count.tenants,
            })),
        });
    } catch (e) {
        logger.error("Super Admin GET SaaS Plans Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        const { name, price, pppoeLimit, hotspotLimit, maxRouters } = body;

        if (!name || price == null) {
            return errorResponse("name and price are required", 400);
        }

        const plan = await db.saasPlan.create({
            data: {
                name,
                price,
                pppoeLimit: pppoeLimit ?? 100,
                hotspotLimit: hotspotLimit ?? null,
                maxRouters: maxRouters ?? 1,
            },
        });

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_CREATE_SAAS_PLAN",
            resource: "SaasPlan",
            resourceId: plan.id,
            details: { planName: name, price },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message: "SaaS plan created", plan: { ...plan, price: Number(plan.price) } }, 201);
    } catch (e) {
        logger.error("Super Admin POST SaaS Plan Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
