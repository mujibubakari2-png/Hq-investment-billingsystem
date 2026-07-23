import { NextResponse } from 'next/server';
import { getTenantClient } from '@/lib/tenantPrisma';
import { requireRole } from '@/lib/rbac';
import { NextRequest } from 'next/server';
import { isPlatformSuperAdmin, getJwtTenantId } from '@/lib/tenant';
import logger from "@/lib/logger";

/**
 * GET /api/debug/system-settings
 *
 * Returns payment channel configs for the current tenant (SUPER_ADMIN only).
 *
 * ── TENANT PRIVACY FIX ────────────────────────────────────────────────────────
 * BEFORE: `findMany({})` — ALL tenants' payment channels visible.
 * AFTER:  `findMany({ where: { tenantId } })` — each tenant sees ONLY their own.
 *
 * Platform Super Admins (tenantId: null) are redirected to use
 * /api/super-admin/settings for platform-level configuration.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, 'SUPER_ADMIN');
        if (guard.error) return guard.error;

        // Platform Super Admin should use /api/super-admin/settings instead
        if (isPlatformSuperAdmin(guard.user)) {
            return NextResponse.json(
                { error: "Platform admins: use /api/super-admin/settings for platform-level settings." },
                { status: 403 }
            );
        }

        const tenantId = getJwtTenantId(guard.user);
        if (!tenantId) {
            return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });
        }

        const db = getTenantClient(guard.user);

        // ── FIXED: Strict tenant filter — each tenant sees ONLY their own channels ──
        const rows = await db.paymentChannel.findMany({
            where: { tenantId }, // <── CRITICAL: was `findMany({})` with no filter
            select: {
                id: true,
                tenantId: true,
                provider: true,
                name: true,
                status: true,
                environment: true,
                createdAt: true,
                updatedAt: true,
                // NOTE: apiKey and apiSecret are intentionally excluded — use
                // /api/payment-channels for full credential management
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ rows });
    } catch (e: unknown) {
        logger.error('[DEBUG_ROUTE] failed to read payment channels:', {
            error: e instanceof Error ? e.message : String(e)
        });
        return NextResponse.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 }
        );
    }
}
