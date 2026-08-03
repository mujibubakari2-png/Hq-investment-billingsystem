import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/cms/subscribers
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
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.email = { contains: search, mode: "insensitive" };
        }

        const [total, subscribers] = await Promise.all([
            db.newsletterSubscriber.count({ where }),
            db.newsletterSubscriber.findMany({
                where,
                skip,
                take: limit,
                orderBy: { subscribedAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: subscribers,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Subscribers Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
