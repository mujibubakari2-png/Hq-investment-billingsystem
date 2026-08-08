import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/ecommerce/coupons
 * POST /api/super-admin/ecommerce/coupons
 */

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "25", 10);
        const skip = (page - 1) * limit;

        const where: Prisma.CouponWhereInput = {};
        if (search) {
            where.code = { contains: search, mode: "insensitive" };
        }

        const [total, coupons] = await Promise.all([
            db.coupon.count({ where }),
            db.coupon.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: coupons,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Coupons Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.code || body.discountAmount === undefined) {
            return errorResponse("Code and discountAmount are required", 400);
        }

        // check unique code
        const existing = await db.coupon.findUnique({ where: { code: body.code } });
        if (existing) return errorResponse("Coupon code already exists", 400);

        const coupon = await db.coupon.create({
            data: {
                code: body.code,
                discountType: body.discountType || "percent",
                discountAmount: parseFloat(body.discountAmount),
                maxUses: body.maxUses !== undefined ? parseInt(body.maxUses, 10) : null,
                expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
                isActive: body.isActive !== undefined ? body.isActive : true,
            }
        });

        return jsonResponse({ success: true, message: "Coupon created", data: coupon });
    } catch (e) {
        logger.error("Super Admin POST Coupon Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
