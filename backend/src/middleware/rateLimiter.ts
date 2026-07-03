/**
 * Rate Limiting Middleware (thin adapter)
 *
 * MEDIUM-SEC-008 FIX:
 * This middleware file was a duplicate of src/lib/rateLimiter.ts with its own
 * independent in-process Map. That meant PM2 worker #1 and worker #2 had
 * separate counters — any user could bypass the limit by having requests
 * distributed across workers.
 *
 * This file is now a THIN ADAPTER that re-exports from lib/rateLimiter.ts,
 * which uses Redis INCR+EXPIRE (shared across all workers).
 *
 * Edge Runtime note: On self-hosted PM2 deployments, Next.js middleware runs
 * in Node.js, so ioredis imports are safe. If you ever deploy to Vercel Edge,
 * replace the lib/rateLimiter.ts import with @upstash/ratelimit (fetch-based).
 */

export {
    rateLimitMiddleware,
    isRateLimited,
    resetRateLimit,
    cleanupRateLimitStore,
    getRateLimitStats,
} from '@/lib/rateLimiter';
