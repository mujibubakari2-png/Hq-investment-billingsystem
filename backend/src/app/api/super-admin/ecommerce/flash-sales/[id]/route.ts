import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/flash-sales/[id]
 * DELETE /api/super-admin/ecommerce/flash-sales/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.flashSale.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Flash Sale not found", 404);

        const sale = await db.flashSale.update({
            where: { id: params.id },
            data: {
                title: body.title !== undefined ? body.title : existing.title,
                discountPercentage: body.discountPercentage !== undefined ? parseFloat(body.discountPercentage) : existing.discountPercentage,
                startDate: body.startDate !== undefined ? new Date(body.startDate) : existing.startDate,
                endDate: body.endDate !== undefined ? new Date(body.endDate) : existing.endDate,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Flash Sale updated", data: sale });
    } catch (e) {
        logger.error("Super Admin PUT Flash Sale Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.flashSale.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Flash Sale not found", 404);

        await db.flashSale.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Flash Sale deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Flash Sale Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
