/**
 * Router Sync Worker
 *
 * VENDOR-ADAPTER-013: Subscription synchronization between DB and routers.
 *
 * Periodically syncs active/expired subscriptions to all connected routers:
 *   - Expired subscriptions → suspend user on router
 *   - Active subscriptions after renewal → re-enable user on router
 *   - Package changes → update profile on router
 *
 * Works via RouterAdapter pattern — same logic for MikroTik, Omada, UniFi, etc.
 * Adapters that don't support PPPoE/Hotspot return { success: false } gracefully.
 */

import "dotenv/config";
import { env } from "@/lib/env";
import logger from "@/lib/logger";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getRouterAdapter, normalizeRouterVendor } from "@/lib/routerAdapters";
import { enqueueSuspendService, enqueueActivateService } from "@/lib/queue";

void env;

// ── Sync expired subscriptions ────────────────────────────────────────────────

export async function syncExpiredSubscriptions(tenantId?: string | null): Promise<{
    suspended: number;
    errors: number;
}> {
    const db = getTenantClient(null);
    const where: any = {
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
    };
    if (tenantId) where.tenantId = tenantId;

    const expired = await db.subscription.findMany({
        where,
        include: {
            client: { select: { username: true } },
            router: { select: { id: true, tenantId: true, vendor: true, type: true } },
        },
    });

    let suspended = 0;
    let errors = 0;

    for (const sub of expired) {
        try {
            if (!sub.router || !sub.client?.username) continue;

            const vendor = normalizeRouterVendor(sub.router.vendor ?? sub.router.type);
            const serviceType = (sub as any).serviceType === "hotspot" ? "hotspot" : "pppoe";

            await enqueueSuspendService(
                sub.router.id,
                sub.router.tenantId ?? null,
                sub.client.username,
                serviceType,
                vendor
            );

            // Mark subscription as EXPIRED in DB
            await db.subscription.update({
                where: { id: sub.id },
                data: { status: "EXPIRED" },
            });

            suspended++;
            logger.info("[RouterSync] Queued suspend for expired subscription", {
                subscriptionId: sub.id,
                username: sub.client.username,
                routerId: sub.router.id,
                vendor,
            });
        } catch (err: any) {
            errors++;
            logger.error("[RouterSync] Failed to queue suspend", {
                subscriptionId: sub.id,
                error: err.message,
            });
        }
    }

    logger.info("[RouterSync] Expired subscription sync complete", { suspended, errors, tenantId });
    return { suspended, errors };
}

// ── Sync recently renewed subscriptions ──────────────────────────────────────

export async function syncRenewedSubscriptions(tenantId?: string | null): Promise<{
    activated: number;
    errors: number;
}> {
    const db = getTenantClient(null);

    // Subscriptions that were recently changed to ACTIVE but
    // their router user is still disabled
    const where: any = {
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        updatedAt: { gt: new Date(Date.now() - 10 * 60 * 1000) }, // changed in last 10 minutes
    };
    if (tenantId) where.tenantId = tenantId;

    const renewed = await db.subscription.findMany({
        where,
        include: {
            client: { select: { username: true } },
            package: { select: { name: true, type: true } },
            router: { select: { id: true, tenantId: true, vendor: true, type: true } },
        },
    });

    let activated = 0;
    let errors = 0;

    for (const sub of renewed) {
        try {
            if (!sub.router || !sub.client?.username) continue;

            const vendor = normalizeRouterVendor(sub.router.vendor ?? (sub.router as any).type);
            const serviceType = (sub.package as any)?.type === "hotspot" ? "hotspot" : "pppoe";

            await enqueueActivateService(
                sub.router.id,
                sub.router.tenantId ?? null,
                sub.client.username,
                "", // Password not stored in client directly
                sub.package?.name ?? "default",
                serviceType,
                sub.expiresAt ? new Date(sub.expiresAt as any) : undefined,
                vendor
            );

            activated++;
        } catch (err: any) {
            errors++;
            logger.error("[RouterSync] Failed to queue activate", { error: err.message });
        }
    }

    logger.info("[RouterSync] Renewal sync complete", { activated, errors, tenantId });
    return { activated, errors };
}

// ── Full sync ─────────────────────────────────────────────────────────────────

export async function runFullSync(tenantId?: string | null): Promise<void> {
    logger.info("[RouterSync] Starting full sync", { tenantId });
    await Promise.all([
        syncExpiredSubscriptions(tenantId),
        syncRenewedSubscriptions(tenantId),
    ]);
    logger.info("[RouterSync] Full sync complete", { tenantId });
}

// ── Entry Point ───────────────────────────────────────────────────────────────

if (require.main === module) {
    runFullSync().then(() => process.exit(0)).catch((err) => {
        logger.error("[RouterSync] Fatal error", { error: err.message });
        process.exit(1);
    });
}
