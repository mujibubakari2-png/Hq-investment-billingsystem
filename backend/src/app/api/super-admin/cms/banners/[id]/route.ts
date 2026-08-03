import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/cms/banners/[id]
 * DELETE /api/super-admin/cms/banners/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.banner.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Banner not found", 404);

        const banner = await db.banner.update({
            where: { id: params.id },
            data: {
                title: body.title !== undefined ? body.title : existing.title,
                subtitle: body.subtitle !== undefined ? body.subtitle : existing.subtitle,
                imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
                linkUrl: body.linkUrl !== undefined ? body.linkUrl : existing.linkUrl,
                linkText: body.linkText !== undefined ? body.linkText : existing.linkText,
                position: body.position !== undefined ? parseInt(body.position, 10) : existing.position,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
                startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : existing.startDate,
                endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : existing.endDate,
            }
        });

        return jsonResponse({ success: true, message: "Banner updated", data: banner });
    } catch (e) {
        logger.error("Super Admin PUT Banner Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.banner.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Banner not found", 404);

        await db.banner.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Banner deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Banner Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
