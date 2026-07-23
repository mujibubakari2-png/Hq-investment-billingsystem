import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/tenant";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";

/**
 * GET /api/admin/tenants
 *
 * ── PRIVACY FIX ──────────────────────────────────────────────────────────────
 * REMOVED: clientCount, userCount, routerCount — these are internal tenant data
 * and violate the strict tenant privacy guarantee.
 * The Super Admin sees ONLY platform-level metadata: name, status, plan, dates.
 *
 * NOTE: This old route is kept for backward compatibility.
 * New code should use /api/super-admin/tenants instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const user = guard.user;
        if (!isPlatformSuperAdmin(user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(null);

        const tenants = await db.tenant.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                trialStart: true,
                trialEnd: true,
                licenseExpiresAt: true,
                createdAt: true,
                plan: { select: { name: true, price: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const mapped = tenants.map(t => ({
            id: t.id,
            name: t.name,
            email: t.email,
            phone: t.phone,
            status: t.status,
            planName: t.plan?.name ?? "Unknown",
            planPrice: t.plan?.price ? Number(t.plan.price) : null,
            trialEnd: t.trialEnd,
            licenseExpiresAt: t.licenseExpiresAt,
            createdAt: t.createdAt,
            // ── PRIVACY: No clientCount, userCount, routerCount ──
        }));

        return jsonResponse(mapped);
    } catch (e) {
        logger.error("ADMIN TENANT FETCH ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const user = guard.user;
        if (!isPlatformSuperAdmin(user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(null);

        const body = await req.json();
        const { action, tenantId, ...data } = body;

        if (!tenantId) return errorResponse("tenantId is required", 400);

        const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return errorResponse("Tenant not found", 404);

        if (action === "confirm") {
            const updated = await db.tenant.update({
                where: { id: tenantId },
                data: { status: "ACTIVE" },
                select: { id: true, name: true, status: true },
            });
            await writeAuditLog({
                tenantId: "platform",
                userId: user.userId,
                action: "PLATFORM_ACTIVATE_TENANT",
                resource: "Tenant",
                resourceId: tenantId,
                details: { tenantName: tenant.name },
                ipAddress: getIpFromRequest(req),
            }).catch(() => {});
            return jsonResponse({ message: "Tenant activated successfully", tenant: updated });
        }

        if (action === "suspend") {
            const updated = await db.tenant.update({
                where: { id: tenantId },
                data: { status: "SUSPENDED" },
                select: { id: true, name: true, status: true },
            });
            await writeAuditLog({
                tenantId: "platform",
                userId: user.userId,
                action: "PLATFORM_SUSPEND_TENANT",
                resource: "Tenant",
                resourceId: tenantId,
                details: { tenantName: tenant.name },
                ipAddress: getIpFromRequest(req),
            }).catch(() => {});
            return jsonResponse({ message: "Tenant suspended successfully", tenant: updated });
        }

        return errorResponse("Invalid action. Use 'confirm' or 'suspend'.", 400);

    } catch (e) {
        logger.error("ADMIN TENANT ACTION ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
