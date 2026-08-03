import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/cms/pages/[id]
 * DELETE /api/super-admin/cms/pages/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.customPage.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Custom Page not found", 404);

        if (body.slug && body.slug !== existing.slug) {
             const slugExists = await db.customPage.findUnique({ where: { slug: body.slug } });
             if (slugExists) return errorResponse("Slug already exists", 400);
        }

        const customPage = await db.customPage.update({
            where: { id: params.id },
            data: {
                title: body.title !== undefined ? body.title : existing.title,
                slug: body.slug !== undefined ? body.slug : existing.slug,
                content: body.content !== undefined ? body.content : existing.content,
                isPublished: body.isPublished !== undefined ? body.isPublished : existing.isPublished,
            }
        });

        return jsonResponse({ success: true, message: "Custom Page updated", data: customPage });
    } catch (e) {
        logger.error("Super Admin PUT Page Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.customPage.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Custom Page not found", 404);

        await db.customPage.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Custom Page deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Page Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
