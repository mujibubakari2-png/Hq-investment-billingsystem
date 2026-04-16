/**
 * Simple database-based rate limiter for API routes.
 *
 * Limits requests per IP address within a sliding window.
 * Uses database store — suitable for multi-instance/serverless deployments.
 */

import { prisma } from "./prisma";

interface RateLimitEntry {
    count: number;
    resetAt: number; // Unix timestamp (ms)
}

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
export async function checkRateLimit(
    key: string,
    namespace: string,
    options: RateLimitOptions
): Promise<RateLimitResult> {
    const storeKey = `${namespace}:${key}`;
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;

    try {
        // Try to find existing entry
        let entry = await prisma.rateLimit.findUnique({
            where: { key: storeKey }
        });

        if (!entry || entry.resetAt.getTime() <= now) {
            // Create new or update expired entry
            entry = await prisma.rateLimit.upsert({
                where: { key: storeKey },
                update: {
                    count: 1,
                    resetAt: new Date(now + windowMs),
                    updatedAt: new Date()
                },
                create: {
                    key: storeKey,
                    count: 1,
                    resetAt: new Date(now + windowMs)
                }
            });
            return {
                allowed: true,
                remaining: options.limit - 1,
                resetAt: entry.resetAt.getTime(),
                retryAfterSeconds: 0,
            };
        }

        // Increment count
        entry = await prisma.rateLimit.update({
            where: { key: storeKey },
            data: {
                count: { increment: 1 },
                updatedAt: new Date()
            }
        });

        if (entry.count > options.limit) {
            const retryAfterSeconds = Math.ceil((entry.resetAt.getTime() - now) / 1000);
            return {
                allowed: false,
                remaining: 0,
                resetAt: entry.resetAt.getTime(),
                retryAfterSeconds,
            };
        }

        return {
            allowed: true,
            remaining: options.limit - entry.count,
            resetAt: entry.resetAt.getTime(),
            retryAfterSeconds: 0,
        };
    } catch (error) {
        // If database fails, allow request to prevent blocking
        console.error('Rate limit check failed:', error);
        return {
            allowed: true,
            remaining: options.limit - 1,
            resetAt: now + windowMs,
            retryAfterSeconds: 0,
        };
    }
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
