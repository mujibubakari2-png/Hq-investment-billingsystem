import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/ecommerce/media
 * POST /api/super-admin/ecommerce/media
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
            where.filename = { contains: search, mode: "insensitive" };
        }

        const [total, assets] = await Promise.all([
            db.mediaAsset.count({ where }),
            db.mediaAsset.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: assets,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET Media Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.url || !body.filename) {
            return errorResponse("URL and filename are required", 400);
        }

        const asset = await db.mediaAsset.create({
            data: {
                url: body.url,
                filename: body.filename,
                fileType: body.fileType || 'IMAGE',
                sizeBytes: body.sizeBytes || 0,
                mimeType: body.mimeType,
                altText: body.altText,
                createdBy: guard.user.userId
            }
        });

        return jsonResponse({ success: true, message: "Media asset created", data: asset });
    } catch (e) {
        logger.error("Super Admin POST Media Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
