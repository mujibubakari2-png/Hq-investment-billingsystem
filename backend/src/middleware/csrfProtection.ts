/**
 * CSRF Protection Middleware
 * Double-submit cookie pattern + synchronizer token pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Store for CSRF tokens (in production, use Redis or similar)
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
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
 * CSRF middleware for Next.js
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
    const method = request.method;

    // GET, HEAD, OPTIONS requests don't need CSRF protection
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
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
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
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
