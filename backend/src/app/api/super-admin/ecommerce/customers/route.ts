import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/ecommerce/customers
 * POST /api/super-admin/ecommerce/customers
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

        const where: Prisma.EcomCustomerWhereInput = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } }
            ];
        }

        const [total, customers] = await Promise.all([
            db.ecomCustomer.count({ where }),
            db.ecomCustomer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: customers,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Customers Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.name || !body.email) {
            return errorResponse("Name and email are required", 400);
        }

        const customer = await db.ecomCustomer.create({
            data: {
                name: body.name,
                email: body.email,
                phone: body.phone,
                status: body.status || 'ACTIVE',
                notes: body.notes,
                createdBy: guard.user.userId
            }
        });

        return jsonResponse({ success: true, message: "Customer created", data: customer });
    } catch (e) {
        logger.error("Super Admin POST Customer Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
