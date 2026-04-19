import { NextRequest, NextResponse } from "next/server";

// In production, set CORS_ORIGIN to your frontend domain (e.g. "https://billing.hqinvestment.co.tz")
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "*";

export function proxy(request: NextRequest) {
    const origin = request.headers.get("origin") || "*";
    
    // In production, you might want to restrict this to specific domains
    // const ALLOWED_ORIGINS = ["https://hq-frontend.up.railway.app", "https://billing.hqinvestment.co.tz"];
    // const isAllowed = ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN === "*";
    const isAllowed = true; // For now, allow all to resolve connectivity issues
    const corsOrigin = isAllowed ? origin : ALLOWED_ORIGIN;

    // Handle preflight requests
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204, // 204 No Content is standard for OPTIONS
            headers: {
                "Access-Control-Allow-Origin": corsOrigin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
                "Access-Control-Max-Age": "86400",
                "Access-Control-Allow-Credentials": "true",
            },
        });
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", corsOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    response.headers.set("Access-Control-Allow-Credentials", "true");

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
