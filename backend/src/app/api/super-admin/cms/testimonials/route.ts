import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/cms/testimonials
 * POST /api/super-admin/cms/testimonials
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

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
                { content: { contains: search, mode: "insensitive" } },
            ];
        }

        const [total, testimonials] = await Promise.all([
            db.testimonial.count({ where }),
            db.testimonial.findMany({
                where,
                skip,
                take: limit,
                orderBy: { sortOrder: "asc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: testimonials,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Testimonials Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.name || !body.content) {
            return errorResponse("Name and content are required", 400);
        }

        const testimonial = await db.testimonial.create({
            data: {
                name: body.name,
                role: body.role || null,
                company: body.company || null,
                content: body.content,
                avatarUrl: body.avatarUrl || null,
                rating: body.rating !== undefined ? parseInt(body.rating, 10) : 5,
                isActive: body.isActive !== undefined ? body.isActive : true,
                sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : 0,
            }
        });

        return jsonResponse({ success: true, message: "Testimonial created", data: testimonial });
    } catch (e) {
        logger.error("Super Admin POST Testimonial Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
