/**
 * Audit Log Helper — HQ Investment ISP Platform
 *
 * Records user activity for SUPER_ADMIN visibility within each tenant.
 * Call `writeAuditLog()` from any API route after a successful mutating action.
 */

import { getTenantClient } from "@/lib/tenantPrisma";

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
 * Write an audit log entry. Failures are silently suppressed so they never
 * break the main operation.
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
                null,
                h(err) {
                    // Audit log writes are best-effort — never throw
                    console.error("[AUDIT] Failed to write audit log:", err);
                }
            }

/**
 * Extract IP address from a Next.js request.
 */
export function getIpFromRequest(req: Request): string | undefined {
            const forwarded = (req.headers as any).get?.("x-forwarded-for")
                || (req.headers as any)["x-forwarded-for"];
            if(forwarded) return String(forwarded).split(",")[0].trim();

            const realIp = (req.headers as any).get?.("x-real-ip")
                || (req.headers as any)["x-real-ip"];
            if(realIp) return String(realIp).trim();

            return undefined;
        }
