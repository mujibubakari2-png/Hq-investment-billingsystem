import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Lightweight health-check used by load balancers and monitoring tools to verify
 * the backend is up.  Returns HTTP 200 with a JSON body.
 */
export async function GET() {
    console.log("[HEALTH] Health check requested");

    try {
        return NextResponse.json(
            {
                status: "ok",
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                version: process.version
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("[HEALTH] Health check failed:", error);
        return NextResponse.json(
            { status: "error", message: "Health check failed" },
            { status: 500 }
        );
    }
}
