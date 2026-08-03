import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/inventory
 * POST /api/super-admin/ecommerce/inventory
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
            where.product = { name: { contains: search, mode: "insensitive" } };
        }

        const [total, movements] = await Promise.all([
            db.stockMovement.count({ where }),
            db.stockMovement.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: { product: { select: { name: true, sku: true, quantity: true } } }
            })
        ]);

        return jsonResponse({
            success: true,
            data: movements,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Inventory Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.productId || !body.type || body.quantity === undefined) {
            return errorResponse("productId, type, and quantity are required", 400);
        }

        const qty = parseInt(body.quantity, 10);

        // Run as a transaction: Create movement and update product quantity
        const result = await db.$transaction(async (tx) => {
            const movement = await tx.stockMovement.create({
                data: {
                    productId: body.productId,
                    type: body.type, // 'IN', 'OUT', 'ADJUST'
                    quantity: qty,
                    notes: body.notes,
                    referenceId: body.referenceId,
                    createdBy: guard.user.userId
                }
            });

            // If it's an IN or OUT we adjust relatively, if ADJUST we set it exactly?
            // Usually IN = add, OUT = subtract, ADJUST = add/subtract based on positive/negative
            // Let's just treat quantity as the diff to apply.
            const product = await tx.product.update({
                where: { id: body.productId },
                data: {
                    quantity: {
                        increment: body.type === 'OUT' ? -qty : qty
                    }
                }
            });

            return { movement, product };
        });

        return jsonResponse({ success: true, message: "Stock updated", data: result });
    } catch (e) {
        logger.error("Super Admin POST Inventory Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
