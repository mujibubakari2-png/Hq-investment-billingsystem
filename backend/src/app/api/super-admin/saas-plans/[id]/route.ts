import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/super-admin/saas-plans/[id]  — update plan */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await ctx.params;
        const db = getTenantClient(null);
        const body = await req.json();
        const { name, price, pppoeLimit, hotspotLimit, maxRouters } = body;

        const existing = await db.saasPlan.findUnique({ where: { id } });
        if (!existing) return errorResponse("Plan not found", 404);

        const updated = await db.saasPlan.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(price !== undefined && { price }),
                ...(pppoeLimit !== undefined && { pppoeLimit }),
                ...(hotspotLimit !== undefined && { hotspotLimit }),
                ...(maxRouters !== undefined && { maxRouters }),
            },
        });

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_UPDATE_SAAS_PLAN",
            resource: "SaasPlan",
            resourceId: id,
            details: { changes: body },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message: "Plan updated", plan: { ...updated, price: Number(updated.price) } });
    } catch (e) {
        logger.error("Super Admin PATCH SaaS Plan Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

/** DELETE /api/super-admin/saas-plans/[id] — delete plan (only if no tenants) */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await ctx.params;
        const db = getTenantClient(null);

        const plan = await db.saasPlan.findUnique({
            where: { id },
            include: { _count: { select: { tenants: true } } },
        });
        if (!plan) return errorResponse("Plan not found", 404);

        if (plan._count.tenants > 0) {
            return errorResponse(`Cannot delete plan "${plan.name}" — ${plan._count.tenants} tenant(s) are still using it.`, 409);
        }

        await db.saasPlan.delete({ where: { id } });

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_DELETE_SAAS_PLAN",
            resource: "SaasPlan",
            resourceId: id,
            details: { planName: plan.name },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message: `Plan "${plan.name}" deleted.` });
    } catch (e) {
        logger.error("Super Admin DELETE SaaS Plan Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
