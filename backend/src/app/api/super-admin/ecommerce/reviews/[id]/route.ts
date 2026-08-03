import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/reviews/[id]
 * DELETE /api/super-admin/ecommerce/reviews/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.review.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Review not found", 404);

        const review = await db.review.update({
            where: { id: params.id },
            data: {
                isApproved: body.isApproved !== undefined ? body.isApproved : existing.isApproved,
            }
        });

        return jsonResponse({ success: true, message: "Review updated", data: review });
    } catch (e) {
        logger.error("Super Admin PUT Review Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.review.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Review not found", 404);

        await db.review.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Review deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Review Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
