import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/brands/[id]
 * DELETE /api/super-admin/ecommerce/brands/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.brand.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Brand not found", 404);

        const brand = await db.brand.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                logoUrl: body.logoUrl !== undefined ? body.logoUrl : existing.logoUrl,
                description: body.description !== undefined ? body.description : existing.description,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Brand updated", data: brand });
    } catch (e) {
        logger.error("Super Admin PUT Brand Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.brand.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Brand not found", 404);

        await db.brand.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Brand deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Brand Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
