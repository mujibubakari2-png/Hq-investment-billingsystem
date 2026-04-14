/**
 * Simple in-memory rate limiter for API routes.
 *
 * Limits requests per IP address within a sliding window.
 * Uses an in-memory store — suitable for a single-instance deployment.
 * For multi-instance/load-balanced setups, swap the store for Redis.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number; // Unix timestamp (ms)
}

// Store is module-level — persists for the lifetime of the process
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.resetAt <= now) {
            store.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
    /** Maximum number of requests allowed in the window */
    limit: number;
    /** Window duration in seconds */
    windowSeconds: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number; // Unix timestamp (ms)
    retryAfterSeconds: number;
}

/**
 * Check whether a key (IP address or user identifier) is within the rate limit.
 *
 * @param key       - Unique identifier for the requester (e.g. client IP)
 * @param namespace - Prefix to namespace limits per route (e.g. "login", "register")
 * @param options   - Rate limit configuration
 */
export function checkRateLimit(
    key: string,
    namespace: string,
    options: RateLimitOptions
): RateLimitResult {
    const storeKey = `${namespace}:${key}`;
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;

    let entry = store.get(storeKey);

    // If no entry or window has expired, start a fresh window
    if (!entry || entry.resetAt <= now) {
        entry = { count: 1, resetAt: now + windowMs };
        store.set(storeKey, entry);
        return {
            allowed: true,
            remaining: options.limit - 1,
            resetAt: entry.resetAt,
            retryAfterSeconds: 0,
        };
    }

    entry.count += 1;

    if (entry.count > options.limit) {
        const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
        return {
            allowed: false,
            remaining: 0,
            resetAt: entry.resetAt,
            retryAfterSeconds,
        };
    }

    return {
        allowed: true,
        remaining: options.limit - entry.count,
        resetAt: entry.resetAt,
        retryAfterSeconds: 0,
    };
}

/**
 * Extract the real client IP from a Next.js request.
 * Respects common proxy headers.
 */
export function getClientIp(req: { headers: { get: (key: string) => string | null } }): string {
    return (
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "unknown"
    );
}
