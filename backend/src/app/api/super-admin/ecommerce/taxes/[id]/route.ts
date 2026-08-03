import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/taxes/[id]
 * DELETE /api/super-admin/ecommerce/taxes/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.taxClass.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Tax Class not found", 404);

        const tax = await db.taxClass.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                ratePercentage: body.ratePercentage !== undefined ? parseFloat(body.ratePercentage) : existing.ratePercentage,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Tax Class updated", data: tax });
    } catch (e) {
        logger.error("Super Admin PUT Tax Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.taxClass.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Tax Class not found", 404);

        await db.taxClass.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Tax Class deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Tax Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
