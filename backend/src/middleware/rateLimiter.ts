/**
 * Rate Limiting Middleware
 * Implements tiered rate limiting based on user role and endpoint
 */

import { NextRequest, NextResponse } from 'next/server';

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

// Store for tracking requests by IP/User
const requestStore = new Map<string, { count: number; resetTime: number }>();

// Endpoint-specific rate limits
const endpointLimits: Record<string, UserRateLimitConfig> = {
    // Authentication endpoints - stricter limits
    '/api/auth/login': {
        anonymous: { windowMs: 15 * 60 * 1000, maxRequests: 5, message: 'Too many login attempts, try again later' },
        user: { windowMs: 15 * 60 * 1000, maxRequests: 20 },
        admin: { windowMs: 15 * 60 * 1000, maxRequests: 50 },
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
function getRateLimitKey(request: NextRequest, userId?: string): string {
    const ip = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-proto') ||
        'unknown';
    return userId ? `${ip}:${userId}` : ip;
}

/**
 * Get user role from request context
 */
function getUserRole(request: NextRequest): 'admin' | 'user' | 'anonymous' {
    const userRole = request.headers.get('x-user-role');
    if (userRole === 'admin') return 'admin';
    if (userRole === 'user') return 'user';
    return 'anonymous';
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
 * Check if request should be rate limited
 */
export function isRateLimited(request: NextRequest, userId?: string): { limited: boolean; message: string; retryAfter?: number } {
    const key = getRateLimitKey(request, userId);
    const role = getUserRole(request);
    const path = new URL(request.url).pathname;
    const config = getRateLimitConfig(path, role);

    const now = Date.now();
    const record = requestStore.get(key);

    if (!record || now > record.resetTime) {
        // Initialize new record
        requestStore.set(key, { count: 1, resetTime: now + config.windowMs });
        return { limited: false, message: '' };
    }

    if (record.count >= config.maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        const message = config.message || `Rate limit exceeded. Try again in ${retryAfter} seconds`;
        return {
            limited: true,
            message,
            retryAfter,
        };
    }

    record.count++;
    return { limited: false, message: '' };
}

/**
 * Rate limiting middleware for Next.js
 */
export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
    const userId = request.headers.get('x-user-id');
    const result = isRateLimited(request, userId || undefined);

    if (result.limited) {
        return NextResponse.json(
            { error: result.message, code: 'RATE_LIMIT_EXCEEDED' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(result.retryAfter || 60),
                    'X-RateLimit-Limit': '100', // Could be dynamic
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + (result.retryAfter || 60)),
                },
            }
        );
    }

    return null;
}

/**
 * Clean up old records periodically (call this in a cron job)
 */
export function cleanupRateLimitStore(): void {
    const now = Date.now();
    for (const [key, record] of requestStore.entries()) {
        if (now > record.resetTime) {
            requestStore.delete(key);
        }
    }
}

/**
 * Reset rate limit for specific user (admin action)
 */
export function resetRateLimit(identifier: string): void {
    requestStore.delete(identifier);
}

/**
 * Get rate limit stats for monitoring
 */
export function getRateLimitStats() {
    return {
        totalKeys: requestStore.size,
        activeKeys: Array.from(requestStore.entries())
            .filter(([_, record]) => Date.now() <= record.resetTime)
            .length,
    };
}
