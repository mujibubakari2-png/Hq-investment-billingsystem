/**
 * redis.ts — Shared Redis connection config
 *
 * EDGE-001 FIX: Extracts the Redis connection parser out of queue.ts (which
 * imports BullMQ and breaks Edge Runtime builds) into its own file.
 *
 * This file is safe to import from:
 *  - cache.ts  (used by rateLimiter.ts → middleware.ts — must be Edge-safe)
 *  - queue.ts  (BullMQ worker — Node.js only, not Edge)
 *
 * It does NOT import BullMQ or any Node.js-only module.
 */

// NOTE: We use console.warn here instead of importing logger to keep this file
// Edge-safe (logger may pull in Node.js-only modules indirectly).

export interface RedisConnectionOptions {
    host: string;
    port: number;
    password?: string;
    tls?: object;
    maxRetriesPerRequest: null;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
    retryStrategy: (times: number) => number;
}

/**
 * Parse a Redis URL into discrete connection options.
 *
 * ROOT-CAUSE FIX: PM2's env_file loader does NOT strip surrounding quotes
 * from values — so `REDIS_URL="redis://..."` in .env is read by PM2 as the
 * literal string `"redis://..."` (with the quote characters included).
 * `new URL('"redis://..."')` throws a TypeError, and the old catch block
 * silently returned 127.0.0.1:6379 without a password, causing:
 *   - ECONNREFUSED when Redis isn't on loopback
 *   - Silent auth failure when Redis requires a password
 *
 * Fix: strip any surrounding single or double quotes before parsing.
 */
export function parseRedisUrl(url: string): { host: string; port: number; password?: string; tls?: object } {
    // Strip surrounding quotes injected by PM2 env_file (it doesn't strip them)
    const cleaned = url.replace(/^["']|["']$/g, '').trim();

    try {
        const u = new URL(cleaned);
        const opts: { host: string; port: number; password?: string; tls?: object } = {
            host: u.hostname,
            port: parseInt(u.port || '6379', 10),
        };
        if (u.password) opts.password = decodeURIComponent(u.password);
        if (u.protocol === 'rediss:') opts.tls = {};
        return opts;
    } catch {
        // Log visibly — a bad REDIS_URL silently falling back to defaults is hard
        // to diagnose in production. Use console.warn to stay Edge-safe.
        console.warn(
            `[Redis] WARNING: Failed to parse REDIS_URL "${cleaned}" — ` +
            'falling back to 127.0.0.1:6379 with NO password. ' +
            'Check that REDIS_URL is a valid URL and has no surrounding quotes in .env'
        );
        return { host: '127.0.0.1', port: 6379 };
    }
}

/**
 * Build the IORedis/BullMQ connection options object from REDIS_URL.
 *
 * retryStrategy: exponential backoff capped at 30 s.
 * This prevents log flooding when Redis is temporarily unavailable
 * (default IORedis behaviour is rapid retries with no cap).
 */
export function getRedisConnection(): RedisConnectionOptions {
    const raw = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    const conn = parseRedisUrl(raw);

    return {
        ...conn,
        maxRetriesPerRequest: null,  // Required by BullMQ
        enableReadyCheck: false,      // Required by BullMQ
        lazyConnect: true,            // Don't connect until first command
        // Exponential backoff: 500ms, 1s, 1.5s … capped at 30s
        // Prevents log floods when Redis is temporarily down
        retryStrategy: (times: number) => Math.min(times * 500, 30_000),
    };
}
