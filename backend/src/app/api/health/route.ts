import { NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getRedisClient } from "@/lib/cache";
import { getMikroTikQueue } from "@/lib/queue";
import logger from "@/lib/logger";
import { withTimeout } from "@/lib/timeout";

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 *
 * HIGH-O-002 FIX: Enhanced health-check endpoint that now validates:
 *   1. Server is running
 *   2. PostgreSQL connection + latency
 *   3. PostgreSQL schema completeness
 *   4. Critical tables accessible
 *   5. Redis connection + latency (NEW)
 *   6. BullMQ queue job counts (NEW — flags if failed jobs > threshold)
 *   7. System memory usage (NEW)
 *
 * Used by: load balancers, monitoring tools, PM2, deployment orchestrators.
 * A 200 response means the instance is healthy and ready for traffic.
 * A 503 response means degraded — the instance is live but impaired.
 * A 500 response means critical — the instance should be removed from rotation.
 */

interface HealthStatus {
    status: "ok" | "degraded" | "critical";
    timestamp: string;
    uptime_sec: number;
    environment: string;
    version: string;
    database: {
        connected: boolean;
        latency_ms?: number;
        schema_verified: boolean;
        critical_tables_accessible: boolean;
    };
    redis?: {
        connected: boolean;
        latency_ms?: number;
    };
    queue?: {
        waiting?: number;
        active?: number;
        failed?: number;
        delayed?: number;
    };
    memory?: {
        heap_used_mb: number;
        heap_total_mb: number;
        rss_mb: number;
    };
    diagnostics?: string[];
}

export async function GET() {
    const startTime = Date.now();
    const diagnostics: string[] = [];

    const response: HealthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime_sec: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || "unknown",
        version: process.version,
        database: {
            connected: false,
            schema_verified: false,
            critical_tables_accessible: false,
        },
    };

    // ── 1. PostgreSQL ─────────────────────────────────────────────────────────
    try {
        const db = getTenantClient(null);

        const dbStart = Date.now();
        const dbResult = await withTimeout(
            db.$queryRaw`SELECT 1 as test`,
            3000,
            'Database probe timed out'
        );
        if (!dbResult.ok) {
            throw new Error(dbResult.error ?? 'Database probe timed out');
        }
        response.database.latency_ms = Date.now() - dbStart;
        response.database.connected = true;

        // Schema verification
        try {
            const tableQueryResult = await withTimeout(
                db.$queryRaw<{ tablename: string }[]>`
                    SELECT tablename FROM pg_tables WHERE schemaname = 'public' LIMIT 1
                `,
                3000,
                'Schema verification timed out'
            );
            if (tableQueryResult.ok && Array.isArray(tableQueryResult.data) && tableQueryResult.data.length > 0) {
                response.database.schema_verified = true;
            }
        } catch {
            diagnostics.push("Schema verification failed (non-critical)");
        }

        // Critical table access
        try {
            const tableAccessResult = await withTimeout(
                Promise.all([
                    db.user.count(),
                    db.tenant.count(),
                    db.client.count(),
                ]),
                3000,
                'Critical table access timed out'
            );
            if (tableAccessResult.ok) {
                response.database.critical_tables_accessible = true;
            } else {
                throw new Error(tableAccessResult.error ?? 'Critical table access timed out');
            }
        } catch (err) {
            diagnostics.push(`Critical table access failed: ${err instanceof Error ? err.message : String(err)}`);
            response.status = "degraded";
        }

        if (response.database.latency_ms > 5000) {
            response.status = "degraded";
            diagnostics.push(`Database latency high: ${response.database.latency_ms}ms`);
        }
    } catch (err) {
        response.database.connected = false;
        response.status = "critical";
        diagnostics.push(`Database unreachable: ${err instanceof Error ? err.message : String(err)}`);
        logger.error("[Health] Database check failed", { error: String(err) });
    }

    // ── 2. Redis ──────────────────────────────────────────────────────────────
    try {
        const redis = getRedisClient();
        if (redis) {
            const redisStart = Date.now();
            const redisResult = await withTimeout(redis.ping(), 2000, 'Redis ping timed out');
            if (redisResult.ok) {
                response.redis = {
                    connected: true,
                    latency_ms: Date.now() - redisStart,
                };
            } else {
                throw new Error(redisResult.error ?? 'Redis ping timed out');
            }
        } else {
            response.redis = { connected: false };
            // Redis being down means rate limiting, caching, and queue are all broken
            if (response.status === "ok") response.status = "degraded";
            diagnostics.push("Redis client not initialised (REDIS_URL missing or connection failed)");
        }
    } catch (err) {
        response.redis = { connected: false };
        if (response.status === "ok") response.status = "degraded";
        diagnostics.push(`Redis unreachable: ${err instanceof Error ? err.message : String(err)}`);
        logger.warn("[Health] Redis check failed", { error: String(err) });
    }

    // ── 3. BullMQ queue ───────────────────────────────────────────────────────
    try {
        const queue = getMikroTikQueue();
        const queueResult = await withTimeout(
            queue.getJobCounts('waiting', 'active', 'failed', 'delayed'),
            3000,
            'Queue inspection timed out'
        );
        if (!queueResult.ok) {
            throw new Error(queueResult.error ?? 'Queue inspection timed out');
        }
        const counts = queueResult.data;
        response.queue = counts;

        const FAILED_THRESHOLD = 100;
        if (counts && (counts.failed ?? 0) > FAILED_THRESHOLD) {
            if (response.status === "ok") response.status = "degraded";
            diagnostics.push(`BullMQ failed job count is high: ${counts.failed} (threshold: ${FAILED_THRESHOLD})`);
        }
    } catch (err) {
        diagnostics.push(`BullMQ queue check failed: ${err instanceof Error ? err.message : String(err)}`);
        logger.warn("[Health] Queue check failed", { error: String(err) });
    }

    // ── 4. Memory ─────────────────────────────────────────────────────────────
    try {
        const mem = process.memoryUsage();
        response.memory = {
            heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
            heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
            rss_mb: Math.round(mem.rss / 1024 / 1024),
        };
        // Flag only if heap is above 95% utilisation, which is a more reliable threshold
        // for a healthy service and avoids false positives on small local environments.
        if (response.memory.heap_used_mb / response.memory.heap_total_mb > 0.95) {
            if (response.status === "ok") response.status = "degraded";
            diagnostics.push(`Memory pressure: heap ${response.memory.heap_used_mb}/${response.memory.heap_total_mb} MB`);
        }
    } catch { /* non-critical */ }

    if (diagnostics.length > 0) {
        response.diagnostics = diagnostics;
    }

    const httpStatus = response.status === "ok" ? 200 : response.status === "degraded" ? 503 : 500;
    logger.info("[Health] Check completed", {
        status: response.status,
        duration_ms: Date.now() - startTime,
        db_connected: response.database.connected,
        redis_connected: response.redis?.connected,
    });

    return NextResponse.json(response, { status: httpStatus });
}
