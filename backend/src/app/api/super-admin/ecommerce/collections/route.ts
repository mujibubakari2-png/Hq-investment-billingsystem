import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/ecommerce/collections
 * POST /api/super-admin/ecommerce/collections
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

        const where: Prisma.CollectionWhereInput = {};
        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        const [total, collections] = await Promise.all([
            db.collection.count({ where }),
            db.collection.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: "asc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: collections,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Collections Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.name) {
            return errorResponse("Name is required", 400);
        }

        const collection = await db.collection.create({
            data: {
                name: body.name,
                bannerUrl: body.bannerUrl || null,
                description: body.description || null,
                isActive: body.isActive !== undefined ? body.isActive : true,
            }
        });

        return jsonResponse({ success: true, message: "Collection created", data: collection });
    } catch (e) {
        logger.error("Super Admin POST Collection Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
