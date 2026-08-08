import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/cms/faqs
 * POST /api/super-admin/cms/faqs
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

        const where: Prisma.FaqWhereInput = {};
        if (search) {
            where.OR = [
                { question: { contains: search, mode: "insensitive" } },
                { answer: { contains: search, mode: "insensitive" } },
            ];
        }

        const [total, faqs] = await Promise.all([
            db.faq.count({ where }),
            db.faq.findMany({
                where,
                skip,
                take: limit,
                orderBy: { sortOrder: "asc" }
            })
        ]);

        return jsonResponse({
            success: true,
            data: faqs,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET FAQs Error:", { error: e instanceof Error ? e.message : String(e) });
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

        if (!body.question || !body.answer) {
            return errorResponse("Question and answer are required", 400);
        }

        const faq = await db.faq.create({
            data: {
                question: body.question,
                answer: body.answer,
                category: body.category || "general",
                sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : 0,
                isActive: body.isActive !== undefined ? body.isActive : true,
            }
        });

        return jsonResponse({ success: true, message: "FAQ created", data: faq });
    } catch (e) {
        logger.error("Super Admin POST FAQ Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
