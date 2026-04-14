import { NextRequest, NextResponse } from "next/server";

// In production, set CORS_ORIGIN to your frontend domain (e.g. "https://billing.hqinvestment.co.tz")
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "*";

export function proxy(request: NextRequest) {
    // Allow CORS for /api/packages so the hotspot login page can fetch packages
    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
