/**
 * Audit Log Helper — HQ Investment ISP Platform
 *
 * Records user activity for SUPER_ADMIN visibility within each tenant.
 * Call `writeAuditLog()` from any API route after a successful mutating action.
 */

import { getTenantClient } from "@/lib/tenantPrisma";
import { getRedisClient } from "@/lib/cache";
import logger from "@/lib/logger";

export interface AuditLogParams {
    tenantId: string;
    userId: string;
    action: string;       // e.g. "CREATE_USER", "DELETE_SUBSCRIBER"
    resource: string;     // e.g. "User", "Client", "Package"
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Write an audit log entry to the database.
 *
 * HIGH-SEC-003 FIX: Failures are now logged via the structured logger (pino →
 * BetterStack) instead of silently dropped via console.error. Additionally, if
 * the DB write fails, the event is pushed to a Redis dead-letter queue
 * (`audit:dlq`) so a background job can replay it later — ensuring no security
 * event is permanently lost.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
    try {
        const db = getTenantClient(params.tenantId);
        await db.auditLog.create({
            data: {
                tenantId: params.tenantId,
                userId: params.userId,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId ?? null,
                details: params.details ? (params.details as any) : undefined,
                ipAddress: params.ipAddress ?? null,
                userAgent: params.userAgent ?? null,
            },
        });
    } catch (err) {
        // HIGH-SEC-003: Use structured logger so BetterStack captures this
        logger.error("[AUDIT] Failed to write audit log — security event at risk", {
            action: params.action,
            resource: params.resource,
            resourceId: params.resourceId,
            tenantId: params.tenantId,
            userId: params.userId,
            error: err instanceof Error ? err.message : String(err),
        });

        // Fallback: push to Redis DLQ for later replay by a background job
        try {
            const redis = getRedisClient();
            if (redis) {
                await redis.lpush("audit:dlq", JSON.stringify({
                    ...params,
                    _failedAt: new Date().toISOString(),
                }));
            }
        } catch {
            // Redis also unavailable — nothing more we can do; the structured
            // log above is the last line of defence.
        }
    }
}

/**
 * Extract IP address from a Next.js request.
 */
export function getIpFromRequest(req: Request): string | undefined {
    const forwarded = (req.headers as any).get?.("x-forwarded-for")
        || (req.headers as any)["x-forwarded-for"];
    if (forwarded) return String(forwarded).split(",")[0].trim();

    const realIp = (req.headers as any).get?.("x-real-ip")
        || (req.headers as any)["x-real-ip"];
    if (realIp) return String(realIp).trim();

    return undefined;
}
