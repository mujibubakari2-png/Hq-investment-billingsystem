import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getJwtTenantId } from "@/lib/tenant";
import { toISOSafe } from "@/lib/dateUtils";
import logger from "@/lib/logger";

/**
 * GET /api/audit-logs
 *
 * Returns paginated audit log entries for the current tenant.
 * SUPER_ADMIN only.
 *
 * Query params:
 *   ?page=1&limit=50&userId=...&action=...&from=ISO&to=ISO
 */
export async function GET(req: NextRequest) {
    const guard = requirePermission(req, "audit-logs:read");
    if (guard.error) return guard.error;

    const tenantId = getJwtTenantId(guard.user);
    if (!tenantId) return errorResponse("Tenant ID missing", 400);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
    const userId = searchParams.get("userId") || undefined;
    const action = searchParams.get("action") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    try {
        const db = getTenantClient(guard.user);
        const where: Record<string, unknown> = { tenantId };

        if (userId) where.userId = userId;
        if (action) where.action = { contains: action, mode: "insensitive" };
        if (from || to) {
            where.createdAt = {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            };
        }

        const [total, logs] = await Promise.all([
            db.auditLog.count({ where }),
            db.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: {
                        select: { id: true, fullName: true, username: true, email: true, role: true },
                    },
                },
            }),
        ]);

        const data = logs.map(log => ({
            id: log.id,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            details: log.details,
            ipAddress: log.ipAddress,
            createdAt: toISOSafe(log.createdAt),
            user: {
                id: log.user.id,
                fullName: log.user.fullName,
                username: log.user.username,
                email: log.user.email,
                role: log.user.role,
            },
        }));

        return jsonResponse({
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (e) {
        logger.error("[AUDIT-LOGS] GET error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
