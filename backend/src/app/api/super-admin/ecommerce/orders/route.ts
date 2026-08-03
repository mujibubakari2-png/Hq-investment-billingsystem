import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/orders
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
        const paymentStatus = searchParams.get("paymentStatus") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const skip = (page - 1) * limit;

        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { customerEmail: { contains: search, mode: "insensitive" } },
                { customerPhone: { contains: search, mode: "insensitive" } },
            ];
        }
        if (status) where.status = status;
        if (paymentStatus) where.paymentStatus = paymentStatus;

        const [total, orders] = await Promise.all([
            db.ecomOrder.count({ where }),
            db.ecomOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    _count: { select: { items: true } }
                }
            })
        ]);

        return jsonResponse({
            success: true,
            data: orders,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Orders Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
