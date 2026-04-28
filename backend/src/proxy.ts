import { NextRequest, NextResponse } from "next/server";

function getAllowedOrigins(): string[] {
    const configured = process.env.CORS_ORIGIN || "";
    return configured
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}

export function proxy(request: NextRequest) {
    const origin = request.headers.get("origin");
    const pathname = new URL(request.url).pathname;
    const allowedOrigins = getAllowedOrigins();
    const isAllowedOrigin = !!origin && allowedOrigins.includes(origin);
    const isPublicHotspotApi = pathname.startsWith("/api/hotspot/");

    // Handle preflight requests
    if (request.method === "OPTIONS") {
        // Public hotspot endpoints are called from the MikroTik captive portal origin (router IP).
        // Allow cross-origin requests without credentials.
        if (isPublicHotspotApi) {
            return new NextResponse(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Accept",
                    "Access-Control-Max-Age": "86400",
                },
            });
        }
        if (!isAllowedOrigin) {
            return new NextResponse(null, { status: 403 });
        }
        return new NextResponse(null, {
            status: 204, // 204 No Content is standard for OPTIONS
            headers: {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
                "Access-Control-Max-Age": "86400",
                "Access-Control-Allow-Credentials": "true",
            },
        });
    }

    const response = NextResponse.next();
    if (isPublicHotspotApi) {
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, Accept");
        return response;
    }
    if (isAllowedOrigin && origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
        response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
}

export const config = {
    matcher: "/api/:path*",
};
