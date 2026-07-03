/**
 * Rate Limiting Middleware — Edge Runtime Compatible
 *
 * EDGE-001 FIX: The Next.js middleware file (src/middleware.ts) runs in Edge
 * Runtime, which does NOT support Node.js APIs (ioredis, bcryptjs, etc.).
 *
 * This file implements a lightweight, Edge-compatible rate limiter using only
 * Web-standard APIs (Map, Date, Response). It is intentionally separate from
 * src/lib/rateLimiter.ts, which uses Redis INCR+EXPIRE for cross-worker
 * state sharing and is used in API route handlers (Node.js runtime).
 *
 * Architecture:
 *   middleware.ts (Edge)  → middleware/rateLimiter.ts  (this file, no Node.js)
 *   API route handlers    → lib/rateLimiter.ts         (Redis-backed, Node.js)
 *
 * Trade-off: In-process Map means each Edge worker instance has its own
 * counter. For production cross-worker rate limiting, use @upstash/ratelimit
 * (fetch-based, Edge-safe). The Redis-backed limiter in lib/rateLimiter.ts
 * still enforces limits per API route.
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// In-memory store — safe in Edge Runtime (no Node.js APIs)
const store = new Map<string, RateLimitEntry>();

// Endpoint-specific limits (requests per window)
const ENDPOINT_LIMITS: Record<string, { windowMs: number; max: number }> = {
    '/api/auth/login':    { windowMs: 15 * 60 * 1000, max: 10  },
    '/api/auth/register': { windowMs: 60 * 60 * 1000, max: 5   },
    '/api/auth':          { windowMs: 15 * 60 * 1000, max: 20  },
};

const DEFAULT_LIMIT = { windowMs: 60 * 1000, max: 120 };

function getLimit(pathname: string) {
    // Exact match first, then prefix match
    if (ENDPOINT_LIMITS[pathname]) return ENDPOINT_LIMITS[pathname];
    for (const prefix of Object.keys(ENDPOINT_LIMITS)) {
        if (pathname.startsWith(prefix)) return ENDPOINT_LIMITS[prefix];
    }
    return DEFAULT_LIMIT;
}

function getRateLimitKey(request: NextRequest, pathname: string): string {
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    return `rl:${ip}:${pathname}`;
}

/**
 * Lightweight edge rate limiter.
 * Returns a 429 NextResponse if the client is rate limited, otherwise null.
 */
export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const { windowMs, max } = getLimit(pathname);
    const key = getRateLimitKey(request, pathname);
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return null;
    }

    entry.count += 1;

    if (entry.count > max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return new NextResponse(
            JSON.stringify({ error: 'Too many requests. Please try again later.' }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': String(retryAfter),
                    'X-RateLimit-Limit': String(max),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
                },
            }
        );
    }

    return null;
}
