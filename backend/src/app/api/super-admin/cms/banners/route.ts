import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/cms/banners
 * POST /api/super-admin/cms/banners
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
                { title: { contains: search, mode: "insensitive" } },
                { subtitle: { contains: search, mode: "insensitive" } },
            ];
        }

        const [total, banners] = await Promise.all([
            db.banner.count({ where }),
            db.banner.findMany({
                where,
                skip,
                take: limit,
                orderBy: { position: "asc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: banners,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Banners Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.imageUrl) {
            return errorResponse("Image URL is required", 400);
        }

        const banner = await db.banner.create({
            data: {
                title: body.title || null,
                subtitle: body.subtitle || null,
                imageUrl: body.imageUrl,
                linkUrl: body.linkUrl || null,
                linkText: body.linkText || null,
                position: body.position !== undefined ? parseInt(body.position, 10) : 0,
                isActive: body.isActive !== undefined ? body.isActive : true,
                startDate: body.startDate ? new Date(body.startDate) : null,
                endDate: body.endDate ? new Date(body.endDate) : null,
            }
        });

        return jsonResponse({ success: true, message: "Banner created", data: banner });
    } catch (e) {
        logger.error("Super Admin POST Banner Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
