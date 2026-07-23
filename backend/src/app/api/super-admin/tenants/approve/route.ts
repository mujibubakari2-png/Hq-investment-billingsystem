import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { sendAccountApprovedNotifications } from "@/lib/accountNotifications";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";

/**
 * POST /api/super-admin/tenants/approve
 *
 * Approves a PENDING_APPROVAL tenant and starts their 10-day trial.
 * NOTE: Approval logic is also handled via PATCH /api/super-admin/tenants/[id]
 * with action="approve". This route exists for backward compatibility.
 */
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        // PLATFORM GUARD: reject tenant-level SUPER_ADMINs
        if (guard.user.tenantId) {
            return errorResponse("Access denied — platform admins only", 403, "NOT_PLATFORM_ADMIN");
        }

        const db = getTenantClient(null);
        const body = await req.json();
        const tenantId = body.tenantId;

        if (!tenantId) {
            return errorResponse("Missing tenantId in request body.", 400);
        }

        const targetTenant = await db.tenant.findUnique({ where: { id: tenantId } });

        if (!targetTenant) {
            return errorResponse("Tenant not found.", 404);
        }

        if (targetTenant.status !== "PENDING_APPROVAL") {
            return errorResponse(`Tenant is already ${targetTenant.status} — cannot approve again.`, 400);
        }

        // Calculate a fresh 10-day trial starting exactly from the moment of approval
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 10);

        const updatedTenant = await db.tenant.update({
            where: { id: tenantId },
            data: {
                status: "TRIALLING",
                trialStart,
                trialEnd,
            },
        });

        await sendAccountApprovedNotifications({
            tenantId: updatedTenant.id,
            tenantName: updatedTenant.name,
            email: updatedTenant.email,
            phone: updatedTenant.phone,
        });

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_APPROVE_TENANT",
            resource: "Tenant",
            resourceId: tenantId,
            details: { tenantName: updatedTenant.name, trialEnd },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({
            message: "Tenant approved successfully! Their 10-day trial has begun.",
            tenant: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                status: updatedTenant.status,
                trialEnd: updatedTenant.trialEnd,
            },
        });

    } catch (e) {
        logger.error("Approve Tenant Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
