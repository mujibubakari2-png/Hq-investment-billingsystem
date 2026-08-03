import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/menus
 * POST /api/super-admin/ecommerce/menus
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

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } }
            ];
        }

        const [total, menus] = await Promise.all([
            db.menu.count({ where }),
            db.menu.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: "asc" },
                include: { items: { orderBy: { sortOrder: "asc" } } }
            })
        ]);

        return jsonResponse({
            success: true,
            data: menus,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Menus Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.name || !body.slug) {
            return errorResponse("Name and slug are required", 400);
        }

        const menu = await db.menu.create({
            data: {
                name: body.name,
                slug: body.slug,
                description: body.description,
                isActive: body.isActive !== undefined ? body.isActive : true,
                createdBy: guard.user.userId
            }
        });

        return jsonResponse({ success: true, message: "Menu created", data: menu });
    } catch (e) {
        logger.error("Super Admin POST Menu Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
