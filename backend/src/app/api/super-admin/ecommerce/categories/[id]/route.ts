import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET    /api/super-admin/ecommerce/categories/[id]
 * PUT    /api/super-admin/ecommerce/categories/[id]
 * DELETE /api/super-admin/ecommerce/categories/[id]
 */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const category = await db.productCategory.findUnique({
            where: { id: params.id },
        });

        if (!category) return errorResponse("Category not found", 404);

        return jsonResponse({ success: true, data: category });
    } catch (e) {
        logger.error("Super Admin GET Category Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.productCategory.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Category not found", 404);

        if (body.slug && body.slug !== existing.slug) {
            const slugCheck = await db.productCategory.findUnique({ where: { slug: body.slug } });
            if (slugCheck) return errorResponse("Category with this slug already exists", 400);
        }

        const category = await db.productCategory.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                slug: body.slug !== undefined ? body.slug : existing.slug,
                icon: body.icon !== undefined ? body.icon : existing.icon,
                image: body.image !== undefined ? body.image : existing.image,
                description: body.description !== undefined ? body.description : existing.description,
                sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
                isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
            },
        });

        return jsonResponse({ success: true, message: "Category updated", data: category });
    } catch (e) {
        logger.error("Super Admin PUT Category Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.productCategory.findUnique({
            where: { id: params.id },
            include: { _count: { select: { products: true } } }
        });
        if (!existing) return errorResponse("Category not found", 404);

        if (existing._count.products > 0) {
            return errorResponse("Cannot delete category with associated products", 400);
        }

        await db.productCategory.delete({
            where: { id: params.id },
        });

        return jsonResponse({ success: true, message: "Category deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Category Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
