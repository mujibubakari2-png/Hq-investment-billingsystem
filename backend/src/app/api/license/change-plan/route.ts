import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getJwtTenantId, isPlatformSuperAdmin } from "@/lib/tenant";

// POST /api/license/change-plan
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" || isPlatformSuperAdmin(userPayload)) {
            return errorResponse("Forbidden: Only the tenant Super Admin can change plans", 403);
        }

        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const body = await req.json();
        const { planId } = body;
        if (!planId) return errorResponse("planId is required", 400);

        // Verify the plan exists
        const newPlan = await prisma.saasPlan.findUnique({ where: { id: planId } });
        if (!newPlan) return errorResponse("Plan not found", 404);

        // Update tenant's plan
        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: { planId: newPlan.id },
            include: { plan: true },
        });

        return jsonResponse({
            message: `Plan changed to "${newPlan.name}" successfully.`,
            plan: {
                id: updated.plan.id,
                name: updated.plan.name,
                price: updated.plan.price,
                clientLimit: updated.plan.clientLimit,
            },
        });
    } catch (error) {
        console.error("Change Plan Error:", error);
        return errorResponse("Internal server error", 500);
    }
}
