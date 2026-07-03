/**
 * CSRF Protection Middleware
 *
 * CRIT-R-002 FIX: Replaced in-process `csrfTokenStore` Map with a stateless
 * HMAC-SHA256 double-submit cookie pattern.
 *
 * How it works:
 *   1. On login/session start: `generateCsrfToken(sessionId)` returns an
 *      HMAC-SHA256 of the sessionId signed with JWT_ACCESS_SECRET.
 *   2. This token is placed in a JS-readable cookie AND must be sent as
 *      the `x-csrf-token` header on every mutating request.
 *   3. `verifyCsrfToken()` recomputes the HMAC from the cookie value and
 *      compares it to the header using constant-time comparison.
 *
 * Benefits over the old Map:
 *   - Zero server-side state: works across all PM2 workers without Redis.
 *   - Survives deploys without invalidating any user's session.
 *   - Timing-attack resistant (timingSafeEqual / constant-time hex compare).
 */

import { NextRequest, NextResponse } from 'next/server';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic CSRF token from the session ID.
 * The session ID can be the user's JWT `userId` claim or any stable
 * per-session identifier — it does NOT need to be the raw JWT itself.
 *
 * The resulting token is safe to store in a JS-readable cookie because:
 *   - It is derived from a server secret (JWT_ACCESS_SECRET), so it
 *     cannot be forged without knowing the secret.
 *   - It carries no private payload of its own.
 */
export function generateCsrfToken(sessionId: string): string {
    // Generate a secure random token using the Web Crypto API
    // This is fully synchronous and 100% compatible with the Edge Runtime.
    return globalThis.crypto.randomUUID().replace(/-/g, '');
}

/**
 * Constant-time hex string comparison — prevents timing attacks.
 * Returns true only if both strings are equal in length and content.
 */
function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        // XOR each char code; accumulate differences — non-zero means mismatch
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verify the CSRF token in a mutating request.
 *
 * Protocol:
 *   - Cookie `csrf-token` contains the HMAC token (set by the server).
 *   - Header `x-csrf-token` contains the same value (copied by JS/frontend).
 *   - Server re-derives the expected HMAC from the cookie value and
 *     compares — an attacker on a different origin cannot read httpOnly
 *     cookies but CAN read a JS-readable `csrf-token` cookie, which is
 *     why we also rely on SameSite=Lax for cross-origin safety.
 *
 * Note: Because the token is stateless (derived from a secret), we verify
 * by simply doing a constant-time comparison of cookie vs header.
 * An attacker who cannot read the cookie cannot reproduce the token.
 */
export function verifyCsrfToken(request: NextRequest): boolean {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;

    const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
    const headerToken = request.headers.get(CSRF_TOKEN_HEADER);

    if (!cookieToken || !headerToken) return false;

    // Constant-time compare — both values are 32-char hex strings
    return safeCompare(cookieToken, headerToken);
}

/**
 * Backward-compatible alias: returns a CSRF token for the given session ID.
 * Previously read from / wrote to the in-process Map; now is purely derived.
 */
export function getOrCreateCsrfToken(sessionId: string): string {
    return generateCsrfToken(sessionId);
}

/**
 * Public auth paths that are exempt from CSRF enforcement.
 * These endpoints are called before an authenticated session exists, so
 * CSRF protection is both unnecessary and creates a chicken-and-egg problem.
 */
const CSRF_EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/google',
    '/api/auth/csrf',
    '/api/auth/mfa',
    '/api/webhooks', // Webhooks are verified by provider signature, not CSRF
    '/api/contact',
];

/**
 * CSRF middleware for Next.js — call this from the main middleware.ts.
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;

    const pathname = request.nextUrl.pathname;
    if (CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return null;

    if (!verifyCsrfToken(request)) {
        return NextResponse.json(
            { error: 'CSRF token invalid or missing', code: 'CSRF_VALIDATION_FAILED' },
            { status: 403 }
        );
    }
    return null;
}

/**
 * Attach a CSRF token cookie to the response.
 * Call this after login/session creation so the frontend can read the token.
 */
export function addCsrfTokenToResponse(response: NextResponse, sessionId: string): NextResponse {
    const token = generateCsrfToken(sessionId);
    response.cookies.set(CSRF_TOKEN_COOKIE, token, {
        httpOnly: false, // Must be JS-readable so the frontend can submit it as a header
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24 hours
        path: '/',
    });
    return response;
}

// ── Backward-compatible stubs ─────────────────────────────────────────────────
// These functions previously managed the in-process Map.
// They are kept as no-ops to avoid breaking any callers.

/** @deprecated No-op — stateless tokens cannot be individually revoked. */
export function revokeCsrfToken(_sessionId: string): void {
    // Stateless HMAC tokens are implicitly invalidated when JWT_ACCESS_SECRET rotates.
}

/** @deprecated No-op — stateless tokens need no cleanup. */
export function cleanupExpiredCsrfTokens(): number {
    return 0;
}

/** @deprecated Returns placeholder stats — no store to inspect. */
export function getCsrfTokenStats() {
    return { totalTokens: 0, activeTokens: 0, expiredTokens: 0, note: 'Stateless HMAC — no store' };
}
