import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getJwtTenantId, isPlatformSuperAdmin } from "@/lib/tenant";

// POST /api/license/change-plan
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        if (isPlatformSuperAdmin(userPayload)) {
            return errorResponse("Forbidden: Only tenant-scoped SUPER_ADMIN users can change plans", 403);
        }

        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const body = await req.json();
        const { planId } = body;
        if (!planId) return errorResponse("planId is required", 400);

        // Verify the plan exists
        const newPlan = await db.saasPlan.findUnique({ where: { id: planId } });
        if (!newPlan) return errorResponse("Plan not found", 404);

        // Update tenant's plan
        const updated = await db.tenant.update({
            where: { id: tenantId },
            data: { planId: newPlan.id },
            include: { plan: true },
        });

        // Update any PENDING invoices to match the new plan's price
        const pendingInvoices = await db.tenantInvoice.findMany({
            where: { tenantId: tenantId, status: "PENDING" }
        });
        
        for (const inv of pendingInvoices) {
            const months = inv.packageMonths || 1;
            await db.tenantInvoice.update({
                where: { id: inv.id },
                data: {
                    planId: newPlan.id,
                    amount: newPlan.price * months
                }
            });
        }

        return jsonResponse({
            message: `Plan changed to "${newPlan.name}" successfully.`,
            plan: {
                id: updated.plan.id,
                name: updated.plan.name,
                price: updated.plan.price,
                pppoeLimit: updated.plan.pppoeLimit,
                hotspotLimit: updated.plan.hotspotLimit,
                maxRouters: updated.plan.maxRouters,
            },
        });
    } catch (error) {
        console.error("Change Plan Error:", error);
        return errorResponse("Internal server error", 500);
    }
}

