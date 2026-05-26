/**
 * DB-Backed Rate Limiter
 *
 * Uses the existing `RateLimit` Prisma model so limits survive server
 * restarts and work across multiple instances. Replaces the in-memory Map.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

const endpointLimits: Record<string, { anonymous: RateLimitConfig; user: RateLimitConfig; admin: RateLimitConfig }> = {
  '/api/auth/login': {
    anonymous: { windowMs: 15 * 60 * 1000, maxRequests: 5,  message: 'Too many login attempts, try again later' },
    user:      { windowMs: 15 * 60 * 1000, maxRequests: 20 },
    admin:     { windowMs: 15 * 60 * 1000, maxRequests: 50 },
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

function getRole(req: NextRequest): 'admin' | 'user' | 'anonymous' {
  const role = req.headers.get('x-user-role');
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'admin';
  if (role) return 'user';
  return 'anonymous';
}

function getConfig(path: string, role: 'admin' | 'user' | 'anonymous'): RateLimitConfig {
  for (const [pattern, cfg] of Object.entries(endpointLimits)) {
    if (path.startsWith(pattern)) return cfg[role];
  }
  return defaultLimit[role];
}

/**
 * Check rate limit against the database.
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
    const now    = new Date();

    const record = await prisma.rateLimit.findUnique({ where: { key } });

    if (!record || record.resetAt <= now) {
      await prisma.rateLimit.upsert({
        where:  { key },
        create: { key, count: 1, resetAt: new Date(now.getTime() + config.windowMs) },
        update: { count: 1,      resetAt: new Date(now.getTime() + config.windowMs) },
      });
      return null;
    }

    if (record.count >= config.maxRequests) {
      const retryAfter = Math.ceil((record.resetAt.getTime() - now.getTime()) / 1000);
      const message    = config.message ?? `Rate limit exceeded. Retry in ${retryAfter}s`;
      logger.warn('Rate limit exceeded', { key, count: record.count, path });
      return NextResponse.json(
        { error: message, code: 'RATE_LIMIT_EXCEEDED' },
        {
          status: 429,
          headers: {
            'Retry-After':           String(retryAfter),
            'X-RateLimit-Limit':     String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(Math.ceil(record.resetAt.getTime() / 1000)),
          },
        },
      );
    }

    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    return null;
  } catch (err: unknown) {
    // Fail open — don't block requests if DB is temporarily unavailable
    logger.error('Rate limiter DB error — failing open', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Cleanup expired rate limit records.
 * Call this from /api/cron or a scheduled job.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: { resetAt: { lte: new Date() } },
  });
  return result.count;
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
