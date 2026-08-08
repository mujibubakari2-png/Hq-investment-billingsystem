import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/ecommerce/shipping
 * POST /api/super-admin/ecommerce/shipping
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

        const where: Prisma.ShippingZoneWhereInput = {};
        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        const [total, zones] = await Promise.all([
            db.shippingZone.count({ where }),
            db.shippingZone.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: "asc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: zones,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Shipping Zones Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.name || body.rate === undefined) {
            return errorResponse("Name and rate are required", 400);
        }

        const zone = await db.shippingZone.create({
            data: {
                name: body.name,
                rate: parseFloat(body.rate),
                isActive: body.isActive !== undefined ? body.isActive : true,
            }
        });

        return jsonResponse({ success: true, message: "Shipping Zone created", data: zone });
    } catch (e) {
        logger.error("Super Admin POST Shipping Zone Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
