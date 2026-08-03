import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/cms/faqs/[id]
 * DELETE /api/super-admin/cms/faqs/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.faq.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("FAQ not found", 404);

        const faq = await db.faq.update({
            where: { id: params.id },
            data: {
                question: body.question !== undefined ? body.question : existing.question,
                answer: body.answer !== undefined ? body.answer : existing.answer,
                category: body.category !== undefined ? body.category : existing.category,
                sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : existing.sortOrder,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "FAQ updated", data: faq });
    } catch (e) {
        logger.error("Super Admin PUT FAQ Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.faq.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("FAQ not found", 404);

        await db.faq.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "FAQ deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE FAQ Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
