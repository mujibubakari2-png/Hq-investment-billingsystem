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

export interface RedisConnectionOptions {
    host: string;
    port: number;
    password?: string;
    tls?: object;
    maxRetriesPerRequest: null;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
}

export function parseRedisUrl(url: string): { host: string; port: number; password?: string; tls?: object } {
    try {
        const u = new URL(url);
        const opts: { host: string; port: number; password?: string; tls?: object } = {
            host: u.hostname,
            port: parseInt(u.port || '6379', 10),
        };
        if (u.password) opts.password = decodeURIComponent(u.password);
        if (u.protocol === 'rediss:') opts.tls = {};
        return opts;
    } catch {
        return { host: '127.0.0.1', port: 6379 };
    }
}

export function getRedisConnection(): RedisConnectionOptions {
    const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    return {
        ...parseRedisUrl(url),
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        lazyConnect: true,
    };
}
