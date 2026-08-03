import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * PUT    /api/super-admin/cms/blogs/[id]
 * DELETE /api/super-admin/cms/blogs/[id]
 */

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        
        const existing = await db.blogPost.findUnique({ where: { id: params.id } });
        if (!existing) return errorResponse("Blog Post not found", 404);

        if (body.slug && body.slug !== existing.slug) {
             const slugExists = await db.blogPost.findUnique({ where: { slug: body.slug } });
             if (slugExists) return errorResponse("Slug already exists", 400);
        }

        const post = await db.blogPost.update({
            where: { id: params.id },
            data: {
                title: body.title !== undefined ? body.title : existing.title,
                slug: body.slug !== undefined ? body.slug : existing.slug,
                content: body.content !== undefined ? body.content : existing.content,
                author: body.author !== undefined ? body.author : existing.author,
                coverImageUrl: body.coverImageUrl !== undefined ? body.coverImageUrl : existing.coverImageUrl,
                isPublished: body.isPublished !== undefined ? body.isPublished : existing.isPublished,
            }
        });

        return jsonResponse({ success: true, message: "Blog Post updated", data: post });
    } catch (e) {
        logger.error("Super Admin PUT Blog Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const existing = await db.blogPost.findUnique({ where: { id: params.id } });
        
        if (!existing) return errorResponse("Blog Post not found", 404);

        await db.blogPost.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Blog Post deleted" });
    } catch (e) {
        logger.error("Super Admin DELETE Blog Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
