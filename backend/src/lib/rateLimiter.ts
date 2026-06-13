/**
 * DB-Backed Rate Limiter
 *
 * Uses the existing `RateLimit` Prisma model so limits survive server
 * restarts and work across multiple instances. Replaces the in-memory Map.
 */

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getUserFromRequest } from '@/lib/auth';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const endpointLimits: Record<string, { anonymous: RateLimitConfig; user: RateLimitConfig; admin: RateLimitConfig }> = {
  '/api/auth/login': {
    anonymous: { windowMs: 15 * 60 * 1000, maxRequests: 5, message: 'Too many login attempts' },
    user:      { windowMs: 15 * 60 * 1000, maxRequests: 20 },
    admin:     { windowMs: 15 * 60 * 1000, maxRequests: 50 },
  },
  '/api/auth/register/request-otp': {
    anonymous: { windowMs: 15 * 60 * 1000, maxRequests: 3, message: 'Too many OTP requests' },
    user:      { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    admin:     { windowMs: 15 * 60 * 1000, maxRequests: 20 },
  },
  '/api/auth/register': {
    anonymous: { windowMs: 60 * 60 * 1000, maxRequests: 3, message: 'Registration limit exceeded, try later' },
    user:      { windowMs: 60 * 60 * 1000, maxRequests: 5  },
    admin:     { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  },
  '/api/auth/forgot-password': {
    anonymous: { windowMs: 15 * 60 * 1000, maxRequests: 3, message: 'Too many password reset attempts' },
    user:      { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    admin:     { windowMs: 15 * 60 * 1000, maxRequests: 20 },
  },
  '/api/webhooks': {
    // Payment gateways can send bursts of webhooks, limit to 200 per minute per IP
    anonymous: { windowMs: 60 * 1000, maxRequests: 200, message: 'Too many webhooks' },
    user:      { windowMs: 60 * 1000, maxRequests: 200 },
    admin:     { windowMs: 60 * 1000, maxRequests: 200 },
  },
};

const defaultLimit = {
  anonymous: { windowMs: 60 * 1000, maxRequests: 30  },
  user:      { windowMs: 60 * 1000, maxRequests: 100 },
  admin:     { windowMs: 60 * 1000, maxRequests: 500 },
};

function getClientKey(req: NextRequest, userId?: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return userId ? `${ip}:${userId}` : ip;
}

// Bug #13 FIX: Extract role from the verified JWT token instead of the
// x-user-role header, which any client could spoof to bypass rate limits.
function getRole(req: NextRequest): 'admin' | 'user' | 'anonymous' {
  try {
    const payload = getUserFromRequest(req);
    if (!payload) return 'anonymous';
    if (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN') return 'admin';
    return 'user';
  } catch {
    return 'anonymous';
  }
}

function getConfig(path: string, role: 'admin' | 'user' | 'anonymous'): RateLimitConfig {
  for (const [pattern, cfg] of Object.entries(endpointLimits)) {
    if (path.startsWith(pattern)) return cfg[role];
  }
  return defaultLimit[role];
}

/**
 * Check rate limit against Redis.
 * Returns null if OK, or a 429 NextResponse if the limit is exceeded.
 */
export async function checkRateLimit(
  req: NextRequest,
  userId?: string,
): Promise<NextResponse | null> {
  try {
    const path   = new URL(req.url).pathname;
    const role   = getRole(req);
    const config = getConfig(path, role);
    const key    = `rl:${path}:${getClientKey(req, userId)}`;
    
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, config.windowMs);
    }
    
    const ttlMs = await redis.pttl(key);
    const resetAt = Date.now() + (ttlMs > 0 ? ttlMs : config.windowMs);

    if (count > config.maxRequests) {
      const retryAfter = Math.ceil(ttlMs / 1000);
      const message    = config.message ?? `Rate limit exceeded. Retry in ${retryAfter}s`;
      logger.warn('Rate limit exceeded', { key, count, path });
      return NextResponse.json(
        { error: message, code: 'RATE_LIMIT_EXCEEDED' },
        {
          status: 429,
          headers: {
            'Retry-After':           String(retryAfter),
            'X-RateLimit-Limit':     String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(Math.ceil(resetAt / 1000)),
          },
        },
      );
    }

    return null;
  } catch (err: unknown) {
    // Fail open or use in-memory fallback if Redis is temporarily unavailable
    logger.error('Rate limiter Redis error — using in-memory fallback', {
      error: err instanceof Error ? err.message : String(err),
    });

    const path = new URL(req.url).pathname;
    const role = getRole(req);
    const config = getConfig(path, role);
    const key = `rl:${path}:${getClientKey(req, userId)}`;
    const now = Date.now();

    const record = memoryRateLimitStore.get(key);
    if (!record || record.resetAt <= now) {
        memoryRateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
        return null;
    }

    if (record.count >= config.maxRequests) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return NextResponse.json(
            { error: config.message ?? `Rate limit exceeded. Retry in ${retryAfter}s`, code: 'RATE_LIMIT_EXCEEDED' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfter),
                    'X-RateLimit-Limit': String(config.maxRequests),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
                },
            },
        );
    }
    
    record.count += 1;
    return null;
  }
}

// In-memory fallback map for when Redis is down
const memoryRateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup in-memory store periodically to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryRateLimitStore.entries()) {
        if (record.resetAt <= now) {
            memoryRateLimitStore.delete(key);
        }
    }
}, 60 * 1000);

/**
 * Cleanup expired rate limit records.
 * Redis handles expiration automatically, so this is a no-op.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  return 0;
}

// ── Legacy compatibility exports (used by src/middleware/rateLimiter.ts) ───────
/** @deprecated Use checkRateLimit() instead */
export function isRateLimited() {
  return { limited: false, message: '' };
}
/** @deprecated Use checkRateLimit() instead */
export function rateLimitMiddleware() {
  return null;
}
/** @deprecated No-op — cleanup is now automatic via DB TTL */
export function cleanupRateLimitStore() {}
/** @deprecated No-op */
export function resetRateLimit(_id: string) {}
/** @deprecated */
export function getRateLimitStats() {
  return { totalKeys: 0, activeKeys: 0 };
}
