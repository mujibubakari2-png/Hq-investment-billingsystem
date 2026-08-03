import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET    /api/super-admin/ecommerce/products/[id]
 * PUT    /api/super-admin/ecommerce/products/[id]
 * DELETE /api/super-admin/ecommerce/products/[id]
 */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const product = await db.product.findUnique({
            where: { id: params.id, deletedAt: null },
            include: {
                category: { select: { id: true, name: true } },
                images: { orderBy: { sortOrder: "asc" } }
            }
        });

        if (!product) return errorResponse("Product not found", 404);

        return jsonResponse({ success: true, data: product });
    } catch (e) {
        logger.error("Super Admin GET Product Error:", { error: e instanceof Error ? e.message : String(e) });
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
        
        const existing = await db.product.findUnique({ where: { id: params.id, deletedAt: null } });
        if (!existing) return errorResponse("Product not found", 404);

        if (body.slug && body.slug !== existing.slug) {
            const slugCheck = await db.product.findUnique({ where: { slug: body.slug } });
            if (slugCheck) return errorResponse("Product with this slug already exists", 400);
        }

        if (body.sku && body.sku !== existing.sku) {
            const skuCheck = await db.product.findUnique({ where: { sku: body.sku } });
            if (skuCheck) return errorResponse("Product with this SKU already exists", 400);
        }

        // Handle image updates if provided
        let imageUpdate = undefined;
        if (body.images !== undefined) {
            // Simplest approach: delete existing and create new
            // A more robust approach would compute diffs
            imageUpdate = {
                deleteMany: {},
                create: body.images.map((img: any, index: number) => ({
                    url: img.url,
                    altText: img.altText || null,
                    isFeatured: index === 0,
                    sortOrder: index
                }))
            };
        }

        const product = await db.product.update({
            where: { id: params.id },
            data: {
                name: body.name !== undefined ? body.name : existing.name,
                slug: body.slug !== undefined ? body.slug : existing.slug,
                sku: body.sku !== undefined ? body.sku : existing.sku,
                barcode: body.barcode !== undefined ? body.barcode : existing.barcode,
                categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
                brandId: body.brandId !== undefined ? body.brandId : existing.brandId,
                price: body.price !== undefined ? body.price : existing.price,
                discountType: body.discountType !== undefined ? body.discountType : existing.discountType,
                discountValue: body.discountValue !== undefined ? body.discountValue : existing.discountValue,
                currency: body.currency !== undefined ? body.currency : existing.currency,
                quantity: body.quantity !== undefined ? body.quantity : existing.quantity,
                description: body.description !== undefined ? body.description : existing.description,
                tags: body.tags !== undefined ? body.tags : existing.tags,
                status: body.status !== undefined ? body.status : existing.status,
                featured: body.featured !== undefined ? body.featured : existing.featured,
                trending: body.trending !== undefined ? body.trending : existing.trending,
                bestSeller: body.bestSeller !== undefined ? body.bestSeller : existing.bestSeller,
                isNew: body.isNew !== undefined ? body.isNew : existing.isNew,
                images: imageUpdate
            },
            include: { images: true }
        });

        return jsonResponse({ success: true, message: "Product updated", data: product });
    } catch (e) {
        logger.error("Super Admin PUT Product Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.product.findUnique({
            where: { id: params.id, deletedAt: null },
            include: { _count: { select: { orderItems: true } } }
        });
        
        if (!existing) return errorResponse("Product not found", 404);

        if (existing._count.orderItems > 0) {
            // Soft delete if ordered
            await db.product.update({
                where: { id: params.id },
                data: { deletedAt: new Date(), status: "ARCHIVED" }
            });
            return jsonResponse({ success: true, message: "Product archived because it has associated orders" });
        } else {
            // Hard delete
            await db.product.delete({
                where: { id: params.id },
            });
            return jsonResponse({ success: true, message: "Product deleted" });
        }
    } catch (e) {
        logger.error("Super Admin DELETE Product Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
