/**
 * Per-Router Rate Limiter (Token Bucket)
 *
 * ENTERPRISE-006: Protect routers from API overload.
 *
 * Uses a Redis-backed token bucket algorithm:
 *   - Each router has a bucket with a configurable capacity
 *   - Tokens refill at a fixed rate per second
 *   - Each API call consumes one token
 *   - If no tokens available, call is rejected (429 Too Many Requests)
 *
 * Default limits per router:
 *   provision ops: 2/min   (heavy — router restarts services)
 *   discovery:    10/min   (medium — read-only capability probe)
 *   service ops:  30/min   (light — activate/suspend user)
 *   health-check: 60/min   (very light — status poll)
 *
 * Usage:
 *   const limiter = getRouterRateLimiter(routerId, 'provision');
 *   if (!await limiter.consume()) throw new Error('Rate limit exceeded');
 */

import { getRedisConnection } from "./queue";
import logger from "@/lib/logger";

// ── Operation Presets ─────────────────────────────────────────────────────────

export type RateLimitOperation = "provision" | "discovery" | "service" | "health";

interface BucketConfig {
    /** Max tokens (burst capacity) */
    capacity: number;
    /** Tokens added per second */
    refillRatePerSec: number;
}

const PRESETS: Record<RateLimitOperation, BucketConfig> = {
    provision: { capacity: 3,   refillRatePerSec: 0.033 }, // 2/min
    discovery: { capacity: 5,   refillRatePerSec: 0.166 }, // 10/min
    service:   { capacity: 10,  refillRatePerSec: 0.5   }, // 30/min
    health:    { capacity: 20,  refillRatePerSec: 1.0   }, // 60/min
};

// ── Redis Lua Token Bucket ────────────────────────────────────────────────────
// Atomic: read bucket → refill → consume → write
// Returns 1 if token was consumed, 0 if limit exceeded.

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(bucket[1]) or capacity
local last_refill = tonumber(bucket[2]) or now

-- Refill tokens based on elapsed time
local elapsed = now - last_refill
local refilled = math.min(capacity, tokens + (elapsed * refill_rate))

if refilled < cost then
    -- Not enough tokens — update but don't consume
    redis.call("HMSET", key, "tokens", refilled, "last_refill", now)
    redis.call("EXPIRE", key, 3600)
    return 0
end

-- Consume token
local new_tokens = refilled - cost
redis.call("HMSET", key, "tokens", new_tokens, "last_refill", now)
redis.call("EXPIRE", key, 3600)
return 1
`;

function bucketKey(routerId: string, operation: RateLimitOperation): string {
    return `router:ratelimit:${operation}:${routerId}`;
}

// ── Rate Limiter Interface ────────────────────────────────────────────────────

export interface RouterRateLimiter {
    routerId: string;
    operation: RateLimitOperation;
    /**
     * Attempt to consume a token.
     * Returns true if allowed, false if rate limit exceeded.
     */
    consume(cost?: number): Promise<boolean>;
    /** Get current token count (for monitoring). */
    getTokens(): Promise<number>;
    /** Admin: reset bucket to full capacity. */
    reset(): Promise<void>;
}

export function getRouterRateLimiter(
    routerId: string,
    operation: RateLimitOperation,
    customConfig?: Partial<BucketConfig>
): RouterRateLimiter {
    const config = { ...PRESETS[operation], ...customConfig };
    const key = bucketKey(routerId, operation);

    return {
        routerId,
        operation,

        async consume(cost = 1): Promise<boolean> {
            const redis = getRedisConnection();
            const now = Date.now() / 1000; // seconds with fractional part
            try {
                const result = await (redis as any).eval(
                    TOKEN_BUCKET_SCRIPT,
                    1,
                    key,
                    config.capacity,
                    config.refillRatePerSec,
                    now,
                    cost
                );
                if (result === 0) {
                    logger.warn(`[RateLimit] Router ${routerId} ${operation} THROTTLED`);
                }
                return result === 1;
            } catch (e) {
                // On Redis error, allow through (fail open)
                logger.error(`[RateLimit] Redis error — failing open: ${e}`);
                return true;
            }
        },

        async getTokens(): Promise<number> {
            const redis = getRedisConnection();
            try {
                const raw = await (redis as any).hget(key, "tokens");
                return raw ? parseFloat(raw) : config.capacity;
            } catch {
                return config.capacity;
            }
        },

        async reset(): Promise<void> {
            const redis = getRedisConnection();
            await (redis as any).del(key);
            logger.info(`[RateLimit] Reset bucket for router ${routerId} op=${operation}`);
        },
    };
}

/**
 * Convenience: check rate limit and throw if exceeded.
 * Use this at the top of any adapter-heavy handler.
 */
export async function enforceRateLimit(
    routerId: string,
    operation: RateLimitOperation
): Promise<void> {
    const limiter = getRouterRateLimiter(routerId, operation);
    const allowed = await limiter.consume();
    if (!allowed) {
        throw Object.assign(
            new Error(`Rate limit exceeded for router ${routerId} (op=${operation})`),
            { code: "RATE_LIMITED", status: 429 }
        );
    }
}
