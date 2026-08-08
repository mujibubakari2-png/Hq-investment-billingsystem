import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/cms/blogs
 * POST /api/super-admin/cms/blogs
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

        const where: Prisma.BlogPostWhereInput = {};
        if (search) {
            where.title = { contains: search, mode: "insensitive" };
        }

        const [total, posts] = await Promise.all([
            db.blogPost.count({ where }),
            db.blogPost.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: posts,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Blogs Error:", { error: e instanceof Error ? e.message : String(e) });
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

        const existing = await db.blogPost.findUnique({ where: { slug: body.slug } });
        if (existing) return errorResponse("Slug already exists", 400);

        const post = await db.blogPost.create({
            data: {
                title: body.title,
                slug: body.slug,
                content: body.content,
                author: body.author || null,
                coverImageUrl: body.coverImageUrl || null,
                isPublished: body.isPublished !== undefined ? body.isPublished : false,
            }
        });

        return jsonResponse({ success: true, message: "Blog Post created", data: post });
    } catch (e) {
        logger.error("Super Admin POST Blog Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
