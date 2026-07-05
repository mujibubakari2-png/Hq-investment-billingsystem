/**
 * Redis Cache Layer — BE-001
 *
 * Provides a thin, tenant-scoped key-value cache on top of ioredis,
 * reusing the same Redis connection config as BullMQ (REDIS_URL env var).
 *
 * Design decisions:
 *  - Lazy singleton: Redis client is only created on first use.
 *  - All keys are namespaced: "hq:{tenantId}:{namespace}:{key}"
 *  - JSON serialisation is automatic (get/set handle parse/stringify).
 *  - Silent degradation: cache misses / Redis unavailability never throw
 *    to the caller — they just return null (cache miss) and log a warning.
 *  - TTLs default to the constants defined below; callers can override.
 */

import IORedis from 'ioredis';
import { getRedisConnection } from '@/lib/redis';
import logger from '@/lib/logger';

// ── TTL constants (seconds) ───────────────────────────────────────────────────
export const TTL = {
    DASHBOARD:      60,   // Dashboard aggregates — tolerate 60 s staleness
    ROUTER_STATUS:  30,   // Router online/offline — refresh every 30 s
    PACKAGES:      300,   // Package list — changes infrequently
    CLIENTS:        60,   // Client counts for dashboard widgets
    SHORT:          15,   // Anything that changes frequently
} as const;

export type TtlKey = keyof typeof TTL;

// ── Redis singleton ───────────────────────────────────────────────────────────

let _client: IORedis | null = null;
let _closing = false;

/**
 * Exported singleton accessor — use this in other modules instead of
 * creating a new `new IORedis(...)` instance.
 */
export function getRedisClient(): IORedis | null {
    return getClient();
}

function getClient(): IORedis | null {
    if (_closing) return null;
    if (_client) return _client;
    // Only create a client when REDIS_URL is configured
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        logger.warn('[Cache] REDIS_URL not set — caching disabled');
        return null;
    }
    try {
        const conn = getRedisConnection();
        // IORedis accepts the same connection options object
        _client = new IORedis({
            host: conn.host,
            port: conn.port,
            password: conn.password,
            tls: (conn as any).tls,
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
            lazyConnect: true,
            connectTimeout: 1000,
            commandTimeout: 1000,
            retryStrategy: () => null,
        });
        _client.on('error', (err) => {
            logger.warn('[Cache] Redis error', { error: err.message });
        });
        return _client;
    } catch (err: any) {
        logger.warn('[Cache] Failed to create Redis client', { error: err.message });
        return null;
    }
}

// ── Key builder ───────────────────────────────────────────────────────────────

/**
 * Build a namespaced Redis key.
 * Format: "hq:{tenantId}:{namespace}:{key}"
 *
 * HIGH-MT-003 FIX: null/undefined tenantId maps to 'platform' so that
 * platform-admin cache entries do not collide under the literal string 'null'.
 * e.g. two platform admins sharing `hq:null:dashboard:stats` was a bug —
 * they now each hit `hq:platform:dashboard:stats` which is scoped correctly.
 */
export function buildKey(tenantId: string | null | undefined, namespace: string, key: string): string {
    const scope = tenantId ?? 'platform';
    return `hq:${scope}:${namespace}:${key}`;
}

// ── Core get / set / del ──────────────────────────────────────────────────────

/**
 * Get a cached value. Returns null on cache miss or Redis error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
    const client = getClient();
    if (!client) return null;
    try {
        const raw = await client.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch (err: any) {
        logger.warn('[Cache] get error', { key, error: err.message });
        return null;
    }
}

/**
 * Store a value with a TTL (seconds). Silently skips on Redis error.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = getClient();
    if (!client) return;
    try {
        await client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err: any) {
        logger.warn('[Cache] set error', { key, error: err.message });
    }
}

/**
 * Delete a single key.
 */
export async function cacheDel(key: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    try {
        await client.del(key);
    } catch (err: any) {
        logger.warn('[Cache] del error', { key, error: err.message });
    }
}

// ── Invalidation helpers ──────────────────────────────────────────────────────

/**
 * Invalidate ALL cache keys for a given tenant.
 * Use after write operations (e.g. new subscription, new client).
 *
 * Uses Redis SCAN to avoid blocking the server with KEYS.
 */
export async function invalidateTenant(tenantId: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    const pattern = `hq:${tenantId}:*`;
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await client.del(...keys);
                logger.debug('[Cache] invalidated', { count: keys.length, tenantId });
            }
        } while (cursor !== '0');
    } catch (err: any) {
        logger.warn('[Cache] invalidateTenant error', { tenantId, error: err.message });
    }
}

/**
 * Invalidate all keys in a specific namespace for a tenant.
 * More targeted than invalidateTenant — use for single-model updates.
 */
export async function invalidateNamespace(tenantId: string, namespace: string): Promise<void> {
    const client = getClient();
    if (!client) return;
    const pattern = `hq:${tenantId}:${namespace}:*`;
    try {
        let cursor = '0';
        do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) await client.del(...keys);
        } while (cursor !== '0');
    } catch (err: any) {
        logger.warn('[Cache] invalidateNamespace error', { tenantId, namespace, error: err.message });
    }
}

// ── Cache-aside helper ────────────────────────────────────────────────────────

/**
 * Read-through cache. Returns cached value if fresh, otherwise calls
 * `fetcher()`, stores the result, and returns it.
 *
 * Usage:
 *   const stats = await withCache(
 *     buildKey(tenantId, 'dashboard', 'stats'),
 *     TTL.DASHBOARD,
 *     () => computeDashboardStats(tenantId)
 *   );
 */
export async function withCache<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
): Promise<T> {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    // Fire-and-forget — don't let a cache write delay the response
    cacheSet(key, fresh, ttlSeconds).catch(() => {});
    return fresh;
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

export async function closeCache(): Promise<void> {
    if (_closing) return;
    _closing = true;
    if (_client) {
        const client = _client;
        _client = null;
        try {
            await client.quit();
        } catch {
            // ignore — Redis quit is best-effort during test teardown
        }
        try {
            await client.disconnect();
        } catch {
            // ignore — disconnect is best-effort during test teardown
        }
    }
}
