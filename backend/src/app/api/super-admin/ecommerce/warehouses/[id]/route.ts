import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/warehouses/[id]
 * DELETE /api/super-admin/ecommerce/warehouses/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.warehouse.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Warehouse not found", 404);

        const warehouse = await db.warehouse.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                location: body.location !== undefined ? body.location : existing.location,
                capacity: body.capacity !== undefined ? parseInt(body.capacity, 10) : existing.capacity,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Warehouse updated", data: warehouse });
    } catch (e) {
        logger.error("Super Admin PUT Warehouse Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.warehouse.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Warehouse not found", 404);

        await db.warehouse.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Warehouse deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Warehouse Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
