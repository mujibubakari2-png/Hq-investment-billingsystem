import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/ecommerce/promotions
 * POST /api/super-admin/ecommerce/promotions
 */

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "25", 10);
        const skip = (page - 1) * limit;

        const where: Prisma.PromotionWhereInput = {};
        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        const [total, promotions] = await Promise.all([
            db.promotion.count({ where }),
            db.promotion.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: promotions,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Promotions Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.name || !body.type) {
            return errorResponse("Name and type are required", 400);
        }

        const promotion = await db.promotion.create({
            data: {
                name: body.name,
                description: body.description,
                type: body.type,
                status: body.status || "DRAFT",
                discountValue: body.discountValue ? parseFloat(body.discountValue) : undefined,
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                endDate: body.endDate ? new Date(body.endDate) : undefined,
                usageLimit: body.usageLimit ? parseInt(body.usageLimit, 10) : undefined,
                createdBy: guard.user.userId
            }
        });

        return jsonResponse({ success: true, message: "Promotion created", data: promotion });
    } catch (e) {
        logger.error("Super Admin POST Promotion Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
