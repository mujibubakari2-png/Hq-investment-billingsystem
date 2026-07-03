import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";
import { rateLimitMiddleware } from "./middleware/rateLimiter";
import { csrfMiddleware, generateCsrfToken } from "./middleware/csrfProtection";

const CSRF_TOKEN_COOKIE = 'csrf-token';

export async function middleware(request: NextRequest) {
    // ── HIGH-O-001: Generate a per-request correlation ID ─────────────────────
    // This ID is propagated into every log entry, making it possible to trace a
    // single request across the API route, BullMQ worker, and MikroTik calls.
    // Include it in error reports or support tickets to pinpoint any request.
    const requestId = crypto.randomUUID();

    // ── Rate limiting ─────────────────────────────────────────────────────────
    const rateLimitResult = await rateLimitMiddleware(request);
    if (rateLimitResult) {
        rateLimitResult.headers.set('X-Request-ID', requestId);
        return rateLimitResult;
    }

    // ── CSRF protection ───────────────────────────────────────────────────────
    const csrfResult = csrfMiddleware(request);
    if (csrfResult) {
        csrfResult.headers.set('X-Request-ID', requestId);
        return csrfResult;
    }

    // ── CORS / proxy ──────────────────────────────────────────────────────────
    const response = proxy(request);

    // Expose request ID on every response so the frontend can attach it to
    // support tickets and the load balancer can log it for correlation.
    response.headers.set('X-Request-ID', requestId);

    // ── CSRF token provisioning ───────────────────────────────────────────────
    // Ensure CSRF token is provided to the client for non-OPTIONS requests.
    // CRIT-R-002: generateCsrfToken() now requires a stable sessionId.
    // We use the session-id cookie when present; fall back to requestId for
    // pre-auth (unauthenticated) requests so they still get a token.
    if (request.method !== 'OPTIONS') {
        let token = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
        if (!token) {
            const sessionId = request.cookies.get('session-id')?.value || requestId;
            token = generateCsrfToken(sessionId);
            response.cookies.set(CSRF_TOKEN_COOKIE, token, {
                httpOnly: false, // Must be readable by JS to be submitted as a header
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 24 * 60 * 60, // 24 hours
                path: '/',
            });
        }
        // Always expose the token in a response header so cross-subdomain
        // frontends can read it without accessing the cookie directly.
        response.headers.set('X-CSRF-Token', token);
    }

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
