import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/ecommerce/flash-sales
 * POST /api/super-admin/ecommerce/flash-sales
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

        const where: Prisma.FlashSaleWhereInput = {};
        if (search) {
            where.title = { contains: search, mode: "insensitive" };
        }

        const [total, sales] = await Promise.all([
            db.flashSale.count({ where }),
            db.flashSale.findMany({
                where,
                skip,
                take: limit,
                orderBy: { startDate: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: sales,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Flash Sales Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.title || !body.discountPercentage || !body.startDate || !body.endDate) {
            return errorResponse("Title, discountPercentage, startDate, and endDate are required", 400);
        }

        const sale = await db.flashSale.create({
            data: {
                title: body.title,
                discountPercentage: parseFloat(body.discountPercentage),
                startDate: new Date(body.startDate),
                endDate: new Date(body.endDate),
                isActive: body.isActive !== undefined ? body.isActive : true,
            }
        });

        return jsonResponse({ success: true, message: "Flash Sale created", data: sale });
    } catch (e) {
        logger.error("Super Admin POST Flash Sale Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
