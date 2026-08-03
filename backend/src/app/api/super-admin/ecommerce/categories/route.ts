import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/categories
 * POST /api/super-admin/ecommerce/categories
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const categories = await db.productCategory.findMany({
            orderBy: { sortOrder: "asc" },
            include: {
                _count: { select: { products: true } },
            },
        });

        return jsonResponse({
            success: true,
            data: categories.map(c => ({
                ...c,
                productCount: c._count.products
            }))
        });
    } catch (e) {
        logger.error("Super Admin GET Categories Error:", { error: e instanceof Error ? e.message : String(e) });
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
        const { name, slug, icon, image, description, sortOrder, isActive } = body;

        if (!name || !slug) {
            return errorResponse("Name and slug are required", 400);
        }

        // check if slug exists
        const existing = await db.productCategory.findUnique({ where: { slug } });
        if (existing) {
            return errorResponse("Category with this slug already exists", 400);
        }

        const category = await db.productCategory.create({
            data: {
                name,
                slug,
                icon: icon || null,
                image: image || null,
                description: description || null,
                sortOrder: sortOrder ?? 0,
                isActive: isActive ?? true,
            },
        });

        return jsonResponse({ success: true, message: "Category created", data: category }, 201);
    } catch (e) {
        logger.error("Super Admin POST Category Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
