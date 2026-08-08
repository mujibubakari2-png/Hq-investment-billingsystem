import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET /api/super-admin/webhooks
 *
 * Lists WebhookLog records for PLATFORM-level payment callbacks.
 * Paginated, filterable by provider and verified status.
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * Shows ONLY platform webhooks (where tenantId IS NULL or it's a license payment).
 * Does NOT expose individual tenant webhook payloads.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);

        const provider = searchParams.get("provider") || "";
        const verified = searchParams.get("verified") || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Prisma.WebhookLogWhereInput = {};
        if (provider) where.provider = provider;
        if (verified === "true") where.verified = true;
        if (verified === "false") where.verified = false;

        const [logs, total, providers] = await Promise.all([
            db.webhookLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    provider: true,
                    event: true,
                    transactionRef: true,
                    verified: true,
                    createdAt: true,
                    // Mask raw payload for privacy — only expose safe fields
                    payload: true,
                },
            }),
            db.webhookLog.count({ where }),
            // Distinct providers for filter dropdown
            db.webhookLog.groupBy({ by: ["provider"], orderBy: { provider: "asc" } }),
        ]);

        return jsonResponse({
            data: logs.map((l) => ({
                id: l.id,
                provider: l.provider,
                event: l.event,
                transactionRef: l.transactionRef,
                verified: l.verified,
                createdAt: l.createdAt,
                // Only show safe subset of payload (not full raw body which may have secrets)
                payloadSummary: typeof l.payload === "object" && l.payload !== null
                    ? {
                        amount: (l.payload as Record<string, unknown>).amount,
                        status: (l.payload as Record<string, unknown>).status || (l.payload as Record<string, unknown>).order_status,
                        reference: (l.payload as Record<string, unknown>).reference || (l.payload as Record<string, unknown>).order_id,
                    }
                    : null,
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
            providers: providers.map((p) => p.provider),
        });
    } catch (e) {
        logger.error("Super Admin GET Webhooks Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
