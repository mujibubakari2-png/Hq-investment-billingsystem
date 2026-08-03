import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET    /api/super-admin/ecommerce/orders/[id]
 * PUT    /api/super-admin/ecommerce/orders/[id]
 */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const order = await db.ecomOrder.findUnique({
            where: { id: params.id, deletedAt: null },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, sku: true, images: true }
                        }
                    }
                }
            }
        });

        if (!order) return errorResponse("Order not found", 404);

        return jsonResponse({ success: true, data: order });
    } catch (e) {
        logger.error("Super Admin GET Order Error:", { error: e instanceof Error ? e.message : String(e) });
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
        
        const existing = await db.ecomOrder.findUnique({ where: { id: params.id, deletedAt: null } });
        if (!existing) return errorResponse("Order not found", 404);

        const order = await db.ecomOrder.update({
            where: { id: params.id },
            data: {
                status: body.status !== undefined ? body.status : existing.status,
                paymentStatus: body.paymentStatus !== undefined ? body.paymentStatus : existing.paymentStatus,
                notes: body.notes !== undefined ? body.notes : existing.notes,
            }
        });

        return jsonResponse({ success: true, message: "Order updated", data: order });
    } catch (e) {
        logger.error("Super Admin PUT Order Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
