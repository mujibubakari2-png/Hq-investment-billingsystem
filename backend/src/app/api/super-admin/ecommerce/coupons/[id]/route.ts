import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/ecommerce/coupons/[id]
 * DELETE /api/super-admin/ecommerce/coupons/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.coupon.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Coupon not found", 404);

        if (body.code && body.code !== existing.code) {
             const codeExists = await db.coupon.findUnique({ where: { code: body.code } });
             if (codeExists) return errorResponse("Coupon code already exists", 400);
        }

        const coupon = await db.coupon.update({
            where: { id: params.id },
            data: {
                code: body.code !== undefined ? body.code : existing.code,
                discountType: body.discountType !== undefined ? body.discountType : existing.discountType,
                discountAmount: body.discountAmount !== undefined ? parseFloat(body.discountAmount) : existing.discountAmount,
                maxUses: body.maxUses !== undefined ? parseInt(body.maxUses, 10) : existing.maxUses,
                expiryDate: body.expiryDate !== undefined ? (body.expiryDate ? new Date(body.expiryDate) : null) : existing.expiryDate,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            }
        });

        return jsonResponse({ success: true, message: "Coupon updated", data: coupon });
    } catch (e) {
        logger.error("Super Admin PUT Coupon Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.coupon.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Coupon not found", 404);

        await db.coupon.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Coupon deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Coupon Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
