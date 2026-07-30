import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getRedisClient } from "@/lib/cache";
import { getMikroTikQueue } from "@/lib/queue";
import { withTimeout } from "@/lib/timeout";
import logger from "@/lib/logger";

/**
 * GET /api/super-admin/system
 *
 * Returns platform system health: DB, Redis, Queue, Memory, and tenant summary stats.
 * Proxies /api/health but adds platform-level context and requires platform admin auth.
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const startTime = Date.now();
        const diagnostics: string[] = [];

        const result: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            uptime_sec: Math.floor(process.uptime()),
            environment: process.env.NODE_ENV || "unknown",
            node_version: process.version,
            status: "ok",
        };

        // ── 1. PostgreSQL ─────────────────────────────────────────────────────
        try {
            const db = getTenantClient(null);
            const dbStart = Date.now();
            const dbProbe = await withTimeout(db.$queryRaw`SELECT 1 as test`, 3000, "DB timeout");
            if (!dbProbe.ok) throw new Error(dbProbe.error ?? "DB timeout");

            result.database = {
                connected: true,
                latency_ms: Date.now() - dbStart,
                status: "ok",
            };

            // Tenant stats (aggregate only — no individual data)
            const [totalTenants, activeTenants, pendingTenants, totalInvoices, pendingPayments] = await Promise.all([
                db.tenant.count(),
                db.tenant.count({ where: { status: "ACTIVE" } }),
                db.tenant.count({ where: { status: "PENDING_APPROVAL" } }),
                db.tenantInvoice.count(),
                db.tenantInvoice.count({ where: { status: "PENDING" } }),
            ]);
            result.platform_stats = { totalTenants, activeTenants, pendingTenants, totalInvoices, pendingPayments };
        } catch (err) {
            result.database = { connected: false, status: "critical" };
            result.status = "critical";
            diagnostics.push(`Database: ${err instanceof Error ? err.message : String(err)}`);
            logger.error("[System Health] DB check failed", { error: String(err) });
        }

        // ── 2. Redis ──────────────────────────────────────────────────────────
        try {
            const redis = getRedisClient();
            if (redis) {
                const redisStart = Date.now();
                const ping = await withTimeout(redis.ping(), 2000, "Redis timeout");
                if (ping.ok) {
                    result.redis = { connected: true, latency_ms: Date.now() - redisStart, status: "ok" };
                } else {
                    throw new Error(ping.error ?? "Redis timeout");
                }
            } else {
                result.redis = { connected: false, status: "unavailable" };
                if (result.status === "ok") result.status = "degraded";
                diagnostics.push("Redis not configured (REDIS_URL missing)");
            }
        } catch (err) {
            result.redis = { connected: false, status: "error" };
            if (result.status === "ok") result.status = "degraded";
            diagnostics.push(`Redis: ${err instanceof Error ? err.message : String(err)}`);
        }

        // ── 3. BullMQ Queue ───────────────────────────────────────────────────
        try {
            const queue = getMikroTikQueue();
            const queueResult = await withTimeout(
                queue.getJobCounts("waiting", "active", "failed", "delayed", "completed"),
                3000,
                "Queue timeout"
            );
            if (!queueResult.ok) throw new Error(queueResult.error ?? "Queue timeout");
            const counts = queueResult.data as any;
            result.queue = { ...counts, status: (counts?.failed ?? 0) > 100 ? "degraded" : "ok" };
            if ((counts?.failed ?? 0) > 100) {
                if (result.status === "ok") result.status = "degraded";
                diagnostics.push(`BullMQ: ${counts?.failed} failed jobs`);
            }
        } catch (err) {
            result.queue = { status: "unavailable" };
            diagnostics.push(`Queue: ${err instanceof Error ? err.message : String(err)}`);
        }

        // ── 4. Memory ─────────────────────────────────────────────────────────
        const mem = process.memoryUsage();
        result.memory = {
            heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
            heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
            rss_mb: Math.round(mem.rss / 1024 / 1024),
            usage_pct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
            status: mem.heapUsed / mem.heapTotal > 0.9 ? "critical" : mem.heapUsed / mem.heapTotal > 0.75 ? "warning" : "ok",
        };
        if (mem.heapUsed / mem.heapTotal > 0.9) {
            if (result.status === "ok") result.status = "degraded";
            diagnostics.push(`Memory pressure: ${Math.round((mem.heapUsed / mem.heapTotal) * 100)}%`);
        }

        // ── 5. Cron info (static config, not live status) ─────────────────────
        result.cron_jobs = [
            { name: "Daily License Check", schedule: "Every day at 02:00", endpoint: "/api/cron/daily-check" },
            { name: "Expire Subscriptions", schedule: "Every hour", endpoint: "/api/cron/expire-subscriptions" },
            { name: "RADIUS Stale Session Sweep", schedule: "Every 15 minutes", endpoint: "/api/cron/radius-stale-session-sweep" },
            { name: "Voucher Reservation Sweep", schedule: "Every 10 minutes", endpoint: "/api/cron/voucher-reservation-sweep" },
        ];

        if (diagnostics.length > 0) result.diagnostics = diagnostics;
        result.response_ms = Date.now() - startTime;

        const httpStatus = result.status === "ok" ? 200 : result.status === "critical" ? 500 : 503;
        return NextResponse.json(result, { status: httpStatus });
    } catch (e) {
        logger.error("Super Admin System Health Error:", { error: e instanceof Error ? e.message : String(e) });
        return NextResponse.json({ error: "Health check failed", status: "critical" }, { status: 500 });
    }
}
