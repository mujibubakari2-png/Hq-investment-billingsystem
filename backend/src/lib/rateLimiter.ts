/**
 * Rate Limiting Middleware
 *
 * CRIT-R-001 FIX: Replaced the in-process `Map` store with Redis INCR+EXPIRE.
 * This ensures rate limit state is shared across all PM2 workers and persists
 * across deploys. When Redis is unavailable the middleware fails open
 * (allows the request) to avoid taking down the API during a Redis outage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getRedisClient } from '@/lib/cache';
import logger from '@/lib/logger';

interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    message?: string; // Custom message
}

interface UserRateLimitConfig {
    anonymous: RateLimitConfig;
    user: RateLimitConfig;
    admin: RateLimitConfig;
}



// Endpoint-specific rate limits
const endpointLimits: Record<string, UserRateLimitConfig> = {
    // Authentication endpoints - stricter limits
    '/api/auth/login': {
        anonymous: { windowMs: 5 * 60 * 1000, maxRequests: 5, message: 'Too many login attempts, try again later' },
        user: { windowMs: 5 * 60 * 1000, maxRequests: 20 },
        admin: { windowMs: 5 * 60 * 1000, maxRequests: 50 },
    },
    '/api/auth/register': {
        anonymous: { windowMs: 60 * 60 * 1000, maxRequests: 3, message: 'Registration limit exceeded, try later' },
        user: { windowMs: 60 * 60 * 1000, maxRequests: 5 },
        admin: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
    },
    '/api/auth/forgot-password': {
        anonymous: { windowMs: 15 * 60 * 1000, maxRequests: 3, message: 'Too many password reset attempts' },
        user: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
        admin: { windowMs: 15 * 60 * 1000, maxRequests: 20 },
    },

    // API endpoints - moderate limits
    '/api/default': {
        anonymous: { windowMs: 60 * 1000, maxRequests: 10 },
        user: { windowMs: 60 * 1000, maxRequests: 60 },
        admin: { windowMs: 60 * 1000, maxRequests: 300 },
    },

    // File upload endpoints - stricter limits
    '/api/upload': {
        anonymous: { windowMs: 60 * 60 * 1000, maxRequests: 0, message: 'Anonymous users cannot upload' },
        user: { windowMs: 60 * 60 * 1000, maxRequests: 10 },
        admin: { windowMs: 60 * 60 * 1000, maxRequests: 50 },
    },

    // Export endpoints - moderate limits
    '/api/export': {
        anonymous: { windowMs: 60 * 60 * 1000, maxRequests: 0, message: 'Anonymous users cannot export' },
        user: { windowMs: 60 * 1000, maxRequests: 5 },
        admin: { windowMs: 60 * 1000, maxRequests: 20 },
    },
};

// Default limit
const defaultLimit: UserRateLimitConfig = {
    anonymous: { windowMs: 60 * 1000, maxRequests: 30 },
    user: { windowMs: 60 * 1000, maxRequests: 100 },
    admin: { windowMs: 60 * 1000, maxRequests: 500 },
};

/**
 * Get rate limit key (IP + User ID)
 */
function getRateLimitKey(request: NextRequest, body: any, userId?: string): string {
    // x-forwarded-proto is a scheme (http/https), NOT an IP address.
    // Removed from fallback chain to prevent all scheme-less requests sharing one key.
    // Also split x-forwarded-for on commas — format is "client, proxy1, proxy2".
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    
    const tenantId = body?.tenantId || 'global';
    const identifier = userId || body?.username || body?.email || 'anonymous';
    
    return `${tenantId}:${identifier}:${ip}`;
}

/**
 * Derive role from verified JWT to prevent header spoofing.
 */
function getUserRole(request: NextRequest): 'admin' | 'user' | 'anonymous' {
    try {
        const payload = getUserFromRequest(request);
        if (!payload) return 'anonymous';
        if (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN') return 'admin';
        return 'user';
    } catch {
        return 'anonymous';
    }
}

/**
 * Get rate limit config for endpoint
 */
function getRateLimitConfig(path: string, role: 'admin' | 'user' | 'anonymous'): RateLimitConfig {
    // Check for exact match
    if (endpointLimits[path]) {
        return endpointLimits[path][role];
    }

    // Check for pattern match
    for (const [pattern, config] of Object.entries(endpointLimits)) {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            if (regex.test(path)) {
                return config[role];
            }
        }
    }

    // Use default
    return defaultLimit[role];
}

/**
 * Check if the request should be rate limited.
 *
 * CRIT-R-001: Uses Redis INCR+EXPIRE for distributed, process-safe counting.
 * Fails open (returns not-limited) if Redis is unavailable.
 */
export async function isRateLimited(
    request: NextRequest,
    userId?: string,
): Promise<{ limited: boolean; message: string; retryAfter?: number }> {
    let body: any = null;
    if (request.method === 'POST' || request.method === 'PUT') {
        try { body = await request.clone().json(); } catch { }
    }

    const resolvedUserId = userId || getUserFromRequest(request)?.userId;
    const key = `rl:${getRateLimitKey(request, body, resolvedUserId)}`;
    const role = getUserRole(request);
    const path = new URL(request.url).pathname;
    const config = getRateLimitConfig(path, role);
    const ttlSec = Math.ceil(config.windowMs / 1000);

    const redis = getRedisClient();
    if (!redis) {
        logger.warn('[RateLimit] Redis unavailable, rate limiting disabled (fail-open)');
        return { limited: false, message: '' };
    }

    try {
        // INCR is atomic across all PM2 workers simultaneously
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, ttlSec);

        if (count > config.maxRequests) {
            const retryAfter = Math.max(1, await redis.ttl(key));
            const message = config.message || `Rate limit exceeded. Try again in ${retryAfter} seconds`;
            return { limited: true, message, retryAfter };
        }
        return { limited: false, message: '' };
    } catch (err: any) {
        logger.warn('[RateLimit] Redis error, failing open', { error: err.message });
        return { limited: false, message: '' };
    }
}

/**
 * Rate limiting middleware for Next.js route handlers.
 */
export async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const result = await isRateLimited(request);
    if (result.limited) {
        return NextResponse.json(
            { error: result.message, code: 'RATE_LIMIT_EXCEEDED' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(result.retryAfter || 60),
                    'X-RateLimit-Limit': '100',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + (result.retryAfter || 60)),
                },
            }
        );
    }
    return null;
}

/**
 * Alias — prefer `rateLimitMiddleware` for new code.
 */
export async function checkRateLimit(request: NextRequest) {
    return await rateLimitMiddleware(request);
}

/**
 * Reset rate limit for a specific key (admin action).
 * With the Redis backend this now works across all workers.
 */
export async function resetRateLimit(identifier: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.del(`rl:${identifier}`);
    } catch (err: any) {
        logger.warn('[RateLimit] resetRateLimit error', { error: err.message });
    }
}

/**
 * @deprecated No-op — Redis TTL handles expiry automatically.
 * Kept for backward compatibility with any cron job that calls it.
 */
export function cleanupRateLimitStore(): void {
    // Redis TTL-based eviction replaces manual Map cleanup.
}

/**
 * Get rate limit stats for monitoring.
 */
export async function getRateLimitStats(): Promise<{ totalKeys: number }> {
    const redis = getRedisClient();
    if (!redis) return { totalKeys: 0 };
    try {
        const keys = await redis.keys('rl:*');
        return { totalKeys: keys.length };
    } catch {
        return { totalKeys: 0 };
    }
}
