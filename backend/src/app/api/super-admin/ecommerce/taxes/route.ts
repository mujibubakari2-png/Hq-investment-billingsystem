import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/taxes
 * POST /api/super-admin/ecommerce/taxes
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

        const where: any = {};
        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        const [total, taxes] = await Promise.all([
            db.taxClass.count({ where }),
            db.taxClass.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: "asc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: taxes,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Taxes Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.name || body.ratePercentage === undefined) {
            return errorResponse("Name and rate are required", 400);
        }

        const tax = await db.taxClass.create({
            data: {
                name: body.name,
                ratePercentage: parseFloat(body.ratePercentage),
                isActive: body.isActive !== undefined ? body.isActive : true,
            }
        });

        return jsonResponse({ success: true, message: "Tax Class created", data: tax });
    } catch (e) {
        logger.error("Super Admin POST Tax Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
