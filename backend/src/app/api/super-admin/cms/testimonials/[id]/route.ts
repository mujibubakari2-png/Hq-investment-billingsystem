import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/cms/testimonials/[id]
 * DELETE /api/super-admin/cms/testimonials/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.testimonial.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Testimonial not found", 404);

        const testimonial = await db.testimonial.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                role: body.role !== undefined ? body.role : existing.role,
                company: body.company !== undefined ? body.company : existing.company,
                content: body.content !== undefined ? body.content : existing.content,
                avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
                rating: body.rating !== undefined ? parseInt(body.rating, 10) : existing.rating,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
                sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : existing.sortOrder,
            }
        });

        return jsonResponse({ success: true, message: "Testimonial updated", data: testimonial });
    } catch (e) {
        logger.error("Super Admin PUT Testimonial Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.testimonial.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Testimonial not found", 404);

        await db.testimonial.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Testimonial deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Testimonial Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
