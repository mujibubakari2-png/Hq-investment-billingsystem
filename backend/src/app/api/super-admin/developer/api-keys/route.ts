import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import { randomBytes, createHash } from "crypto";

/**
 * GET  /api/super-admin/developer/api-keys
 * POST /api/super-admin/developer/api-keys
 */

function generateApiKey(): { raw: string; hash: string } {
    const raw = `hq_${randomBytes(24).toString("hex")}`;
    const hash = createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "25", 10);
        const skip = (page - 1) * limit;

        const where: any = { deletedAt: null };

        const [total, keys] = await Promise.all([
            db.apiKey.count({ where }),
            db.apiKey.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                // Never return the hash
                select: {
                    id: true,
                    name: true,
                    scopes: true,
                    isActive: true,
                    lastUsedAt: true,
                    expiresAt: true,
                    createdAt: true,
                    createdBy: true
                }
            })
        ]);

        return jsonResponse({
            success: true,
            data: keys,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (e) {
        logger.error("Super Admin GET API Keys Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        const db = getTenantClient(null);
        const body = await req.json();

        if (!body.name) {
            return errorResponse("Name is required", 400);
        }

        const { raw, hash } = generateApiKey();

        await db.apiKey.create({
            data: {
                name: body.name,
                keyHash: hash,
                scopes: body.scopes || [],
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
                createdBy: guard.user.userId
            }
        });

        // Return the raw key ONLY ONCE at creation — it will never be retrievable again
        return jsonResponse({
            success: true,
            message: "API Key created. Save the raw key — it will NOT be shown again.",
            rawKey: raw
        });
    } catch (e) {
        logger.error("Super Admin POST API Key Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
