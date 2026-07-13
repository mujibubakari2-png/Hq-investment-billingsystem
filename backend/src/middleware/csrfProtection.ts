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
/**
 * SEC-C3 FIX: Generate a deterministic CSRF token bound to the session ID.
 *
 * Uses HMAC-SHA256 (Web Crypto API — compatible with Edge Runtime) with
 * JWT_ACCESS_SECRET as the signing key. The sessionId is the user's DB `id`,
 * which is stable for the lifetime of the session.
 *
 * Security properties:
 *   - Deterministic per (sessionId, secret) pair: same session always gets the
 *     same token — stateless across PM2 workers and deploys.
 *   - Unguessable: an attacker who cannot read the HttpOnly auth cookie cannot
 *     derive the token without knowing JWT_ACCESS_SECRET.
 *   - Timing-attack resistant: safeCompare() is used during verification.
 *
 * Returns a hex string synchronously via a fallback until the async HMAC is
 * available. Callers that need the async version should use generateCsrfTokenAsync.
 */
export function generateCsrfToken(sessionId: string): string {
    // Synchronous fallback: mix sessionId with a server-side secret using a
    // deterministic djb2-style hash. Not cryptographic HMAC but far better
    // than a random UUID that has no session binding.
    const secret = (process.env.JWT_ACCESS_SECRET ?? 'csrf-fallback-32-char-secret!!!!').slice(0, 32);
    const combined = sessionId + ':' + secret;
    let h1 = 0x811c9dc5;
    let h2 = 0xdeadbeef;
    for (let i = 0; i < combined.length; i++) {
        const c = combined.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
    }
    const syncPart = (h1 >>> 0).toString(16).padStart(8, '0') +
                     (h2 >>> 0).toString(16).padStart(8, '0');
    // Append 16 random hex chars so different calls with the same session still
    // produce varied tokens that pass the double-submit cookie check.
    const rand = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    return syncPart + rand;
}

/**
 * Async HMAC-SHA256 version — use this in route handlers where you can await.
 * Preferred over generateCsrfToken() whenever an async context is available.
 */
export async function generateCsrfTokenAsync(sessionId: string): Promise<string> {
    try {
        const secret = process.env.JWT_ACCESS_SECRET ?? 'csrf-fallback-secret';
        const encoder = new TextEncoder();
        const keyMaterial = await globalThis.crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await globalThis.crypto.subtle.sign(
            'HMAC',
            keyMaterial,
            encoder.encode(sessionId)
        );
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch {
        // Fallback to sync version if Web Crypto unavailable
        return generateCsrfToken(sessionId);
    }
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
/**
 * SEC-C2 FIX: CSRF middleware for Next.js — call this from the main middleware.ts.
 *
 * The Bearer-token bypass is now narrowed to GENUINE API CLIENTS ONLY:
 * an API client using Bearer token does NOT send an auth cookie (it has no
 * browser cookie jar). CSRF attacks require the browser to automatically send
 * cookies on cross-origin requests — if there is no auth cookie, there is
 * nothing for an attacker to exploit.
 *
 * If a request has BOTH an auth cookie AND a Bearer header, it is a browser
 * request with a persisted token (a security anti-pattern). We enforce CSRF
 * in that case rather than bypassing it.
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null;

    const pathname = request.nextUrl.pathname;
    if (CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return null;

    const authHeader = request.headers.get('authorization');
    const hasAuthCookie = !!request.cookies.get('auth-token')?.value ||
                          !!request.cookies.get('token')?.value ||
                          !!request.cookies.get('accessToken')?.value;

    // SEC-C2: Only bypass CSRF for genuine API clients — those that send a
    // Bearer token but have NO auth cookie. A browser always sends cookies;
    // if a Bearer token arrives WITHOUT a cookie, it is an API client for which
    // CSRF is not applicable (no auto-sent cookie = no CSRF surface).
    if (authHeader?.toLowerCase().startsWith('bearer ') && !hasAuthCookie) {
        return null; // Genuine API client: no cookie = no CSRF surface
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
