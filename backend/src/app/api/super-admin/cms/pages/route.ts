import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/cms/pages
 * POST /api/super-admin/cms/pages
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
            where.title = { contains: search, mode: "insensitive" };
        }

        const [total, pages] = await Promise.all([
            db.customPage.count({ where }),
            db.customPage.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: pages,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Pages Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.title || !body.slug || !body.content) {
            return errorResponse("Title, slug, and content are required", 400);
        }

        const existing = await db.customPage.findUnique({ where: { slug: body.slug } });
        if (existing) return errorResponse("Slug already exists", 400);

        const customPage = await db.customPage.create({
            data: {
                title: body.title,
                slug: body.slug,
                content: body.content,
                isPublished: body.isPublished !== undefined ? body.isPublished : false,
            }
        });

        return jsonResponse({ success: true, message: "Custom Page created", data: customPage });
    } catch (e) {
        logger.error("Super Admin POST Page Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
