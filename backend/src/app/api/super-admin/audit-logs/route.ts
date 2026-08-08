import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

/**
 * GET  /api/super-admin/audit-logs    — platform-level audit log
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * Returns ONLY actions performed by the Platform Super Admin itself.
 * Does NOT return tenant-level audit logs (tenant user actions within their own system).
 * Filtered to actions with PLATFORM_ prefix (see writeAuditLog calls across
 * super-admin routes) or actions with a null tenantId.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action") || "";
        const adminUserId = searchParams.get("userId") || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Prisma.AuditLogWhereInput = {
            // Only platform-level actions
            action: { startsWith: "PLATFORM_" },
        };
        if (action) where.action = { contains: action.toUpperCase() };
        if (adminUserId) where.userId = adminUserId;

        const [logs, total] = await Promise.all([
            db.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    user: {
                        select: { username: true, email: true, fullName: true },
                    },
                },
            }),
            db.auditLog.count({ where }),
        ]);

        return jsonResponse({
            data: logs.map((l) => ({
                id: l.id,
                action: l.action,
                resource: l.resource,
                resourceId: l.resourceId,
                details: l.details,
                ipAddress: l.ipAddress,
                userAgent: l.userAgent,
                createdAt: l.createdAt,
                performedBy: {
                    id: l.userId,
                    username: l.user?.username,
                    email: l.user?.email,
                    fullName: l.user?.fullName,
                },
            })),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (e) {
        logger.error("Super Admin GET Audit Logs Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
