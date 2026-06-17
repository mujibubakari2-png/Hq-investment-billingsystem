import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { sendAccountApprovedNotifications } from "@/lib/accountNotifications";

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);

        const body = await req.json();
        const tenantId = body.tenantId;

        if (!tenantId) {
            return errorResponse("Missing tenantId in request body.", 400);
        }

        const targetTenant = await db.tenant.findUnique({
            where: { id: tenantId }
        });

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
                status: "TRIALLING",   // trial tracking — auto-suspends when trialEnd passes
                trialStart,
                trialEnd
            }
        });

        await sendAccountApprovedNotifications({
            tenantId: updatedTenant.id,
            tenantName: updatedTenant.name,
            email: updatedTenant.email,
            phone: updatedTenant.phone,
        });

        return jsonResponse({
            message: "Tenant approved successfully! Their 10-day trial has begun.",
            tenant: {
                id: updatedTenant.id,
                name: updatedTenant.name,
                status: updatedTenant.status,
                trialEnd: updatedTenant.trialEnd
            }
        });

    } catch (e) {
        console.error("Approve Tenant Error:", e);
        return errorResponse("Internal server error", 500);
    }
}

