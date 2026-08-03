import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/products
 * POST /api/super-admin/ecommerce/products
 */

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;
        const categoryId = searchParams.get("categoryId") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const skip = (page - 1) * limit;

        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status) where.status = status;
        if (categoryId) where.categoryId = categoryId;

        const [total, products] = await Promise.all([
            db.product.count({ where }),
            db.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    category: { select: { id: true, name: true } },
                    images: { orderBy: { sortOrder: "asc" }, take: 1 }
                }
            })
        ]);

        return jsonResponse({
            success: true,
            data: products,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Products Error:", { error: e instanceof Error ? e.message : String(e) });
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
        
        const {
            name, slug, sku, barcode, categoryId, brand, price, discountType,
            discountValue, currency, quantity, description, tags, status,
            featured, trending, bestSeller, isNew, images
        } = body;

        if (!name || !slug || price == null) {
            return errorResponse("Name, slug, and price are required", 400);
        }

        const existingSlug = await db.product.findUnique({ where: { slug } });
        if (existingSlug) return errorResponse("Product with this slug already exists", 400);

        if (sku) {
            const existingSku = await db.product.findUnique({ where: { sku } });
            if (existingSku) return errorResponse("Product with this SKU already exists", 400);
        }

        // Handle image creation data
        const imageCreate = images?.length > 0 ? {
            create: images.map((img: any, index: number) => ({
                url: img.url,
                altText: img.altText || null,
                isFeatured: index === 0, // make first image featured
                sortOrder: index
            }))
        } : undefined;

        const product = await db.product.create({
            data: {
                name,
                slug,
                sku: sku || null,
                barcode: barcode || null,
                categoryId: categoryId || null,
                brand: brand || null,
                price,
                discountType: discountType || "percent",
                discountValue: discountValue || null,
                currency: currency || "TZS",
                quantity: quantity ?? 0,
                description: description || null,
                tags: tags || [],
                status: status || "DRAFT",
                featured: featured ?? false,
                trending: trending ?? false,
                bestSeller: bestSeller ?? false,
                isNew: isNew ?? false,
                images: imageCreate
            },
            include: { images: true }
        });

        return jsonResponse({ success: true, message: "Product created", data: product }, 201);
    } catch (e) {
        logger.error("Super Admin POST Product Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
