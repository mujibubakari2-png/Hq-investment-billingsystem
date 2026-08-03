import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/reviews
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
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { authorName: { contains: search, mode: "insensitive" } },
                { comment: { contains: search, mode: "insensitive" } },
                { title: { contains: search, mode: "insensitive" } },
            ];
        }

        const [total, reviews] = await Promise.all([
            db.review.count({ where }),
            db.review.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: { product: { select: { id: true, name: true } } }
            })
        ]);

        return jsonResponse({
            success: true,
            data: reviews,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Reviews Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
