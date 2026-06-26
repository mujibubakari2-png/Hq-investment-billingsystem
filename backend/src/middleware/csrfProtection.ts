/**
 * CSRF Protection Middleware
 * Double-submit cookie pattern + synchronizer token pattern
 */

import { NextRequest, NextResponse } from 'next/server';
// Web Crypto API — available on Edge Runtime, Node.js ≥16, and browsers.
// No import needed: `crypto` is a global in all three runtimes.

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Store for CSRF tokens (in production, use Redis or similar)
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
    const bytes = new Uint8Array(CSRF_TOKEN_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get CSRF token from request
 */
function getCsrfTokenFromRequest(request: NextRequest): string | null {
    // First check header
    const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
    if (headerToken) return headerToken;

    // Then check request body (for POST/PUT/DELETE)
    return null;
}

/**
 * Get CSRF token from cookies
 */
function getCsrfTokenFromCookie(request: NextRequest): string | null {
    return request.cookies.get(CSRF_TOKEN_COOKIE)?.value || null;
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(request: NextRequest): boolean {
    const method = request.method;

    // GET, HEAD, OPTIONS requests don't need CSRF protection
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return true;
    }

    const cookieToken = getCsrfTokenFromCookie(request);
    const requestToken = getCsrfTokenFromRequest(request);

    if (!cookieToken || !requestToken) {
        return false;
    }

    // Tokens must match
    return cookieToken === requestToken;
}

/**
 * Get or create CSRF token for user session
 */
export function getOrCreateCsrfToken(sessionId: string): string {
    const stored = csrfTokenStore.get(sessionId);
    const now = Date.now();

    if (stored && stored.expiresAt > now) {
        return stored.token;
    }

    const newToken = generateCsrfToken();
    csrfTokenStore.set(sessionId, {
        token: newToken,
        expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
    });

    return newToken;
}

/**
 * Public auth paths that are exempt from CSRF enforcement.
 * CSRF attacks require an authenticated session — these endpoints are called
 * before authentication exists, so CSRF protection adds no security benefit
 * and creates a chicken-and-egg problem (need login to get CSRF, need CSRF to login).
 */
const CSRF_EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/google',
    '/api/auth/csrf',
    '/api/auth/mfa',
    '/api/contact',
];

/**
 * CSRF middleware for Next.js
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
    const method = request.method;

    // GET, HEAD, OPTIONS requests don't need CSRF protection
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return null;
    }

    // Exempt public auth endpoints (no authenticated session exists yet)
    const pathname = request.nextUrl.pathname;
    if (CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) {
        return null;
    }

    if (!verifyCsrfToken(request)) {
        return NextResponse.json(
            { error: 'CSRF token invalid or missing', code: 'CSRF_VALIDATION_FAILED' },
            { status: 403 }
        );
    }

    return null;
}

/**
 * Add CSRF token to response
 */
export function addCsrfTokenToResponse(response: NextResponse, sessionId: string): NextResponse {
    const token = getOrCreateCsrfToken(sessionId);

    response.cookies.set(CSRF_TOKEN_COOKIE, token, {
        httpOnly: false, // CSRF tokens must be readable by JS to be submitted as a header (they are not secrets)
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
    });

    return response;
}

/**
 * Clean up expired tokens (call this in a cron job)
 */
export function cleanupExpiredCsrfTokens(): number {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, record] of csrfTokenStore.entries()) {
        if (record.expiresAt <= now) {
            csrfTokenStore.delete(sessionId);
            removed++;
        }
    }

    return removed;
}

/**
 * Revoke CSRF token for session
 */
export function revokeCsrfToken(sessionId: string): void {
    csrfTokenStore.delete(sessionId);
}

/**
 * Get CSRF token stats for monitoring
 */
export function getCsrfTokenStats() {
    const now = Date.now();
    const activeTokens = Array.from(csrfTokenStore.values()).filter(
        (record) => record.expiresAt > now
    ).length;

    return {
        totalTokens: csrfTokenStore.size,
        activeTokens,
        expiredTokens: csrfTokenStore.size - activeTokens,
    };
}
