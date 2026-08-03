import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/collections/[id]
 * DELETE /api/super-admin/ecommerce/collections/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.collection.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Collection not found", 404);

        const collection = await db.collection.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                bannerUrl: body.bannerUrl !== undefined ? body.bannerUrl : existing.bannerUrl,
                description: body.description !== undefined ? body.description : existing.description,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Collection updated", data: collection });
    } catch (e) {
        logger.error("Super Admin PUT Collection Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.collection.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Collection not found", 404);

        await db.collection.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Collection deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Collection Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
