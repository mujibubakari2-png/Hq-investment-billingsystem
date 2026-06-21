import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";
import { rateLimitMiddleware } from "./middleware/rateLimiter";
import { csrfMiddleware, generateCsrfToken } from "./middleware/csrfProtection";

const CSRF_TOKEN_COOKIE = 'csrf-token';

export async function middleware(request: NextRequest) {
    // First apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request);
    if (rateLimitResult) {
        return rateLimitResult;
    }

    // Then apply CSRF protection
    const csrfResult = csrfMiddleware(request);
    if (csrfResult) {
        return csrfResult;
    }

    // Then apply CORS proxy
    const response = proxy(request);

    // Ensure CSRF token is provided to the client for non-OPTIONS requests
    if (request.method !== 'OPTIONS') {
        let token = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
        if (!token) {
            token = generateCsrfToken();
            response.cookies.set(CSRF_TOKEN_COOKIE, token, {
                httpOnly: false, // Must be readable by JS to be submitted as a header
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 24 * 60 * 60, // 24 hours
                path: '/',
            });
        }
        // Always expose the token in a header so cross-subdomain frontends can read it
        response.headers.set('X-CSRF-Token', token);
    }

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
