import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/shipping/[id]
 * DELETE /api/super-admin/ecommerce/shipping/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.shippingZone.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Shipping Zone not found", 404);

        const zone = await db.shippingZone.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                rate: body.rate !== undefined ? parseFloat(body.rate) : existing.rate,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Shipping Zone updated", data: zone });
    } catch (e) {
        logger.error("Super Admin PUT Shipping Zone Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.shippingZone.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Shipping Zone not found", 404);

        await db.shippingZone.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Shipping Zone deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Shipping Zone Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
