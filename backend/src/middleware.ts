import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";
import { rateLimitMiddleware } from "./middleware/rateLimiter";
import { csrfMiddleware } from "./middleware/csrfProtection";

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
    return proxy(request);
}

export const config = {
    matcher: "/api/:path*",
};
