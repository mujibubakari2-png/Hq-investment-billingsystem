import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Lightweight health-check used by Render (and any load balancer) to verify
 * the backend is up.  Returns HTTP 200 with a JSON body.
 */
export async function GET() {
    return NextResponse.json(
        { status: "ok", timestamp: new Date().toISOString() },
        { status: 200 }
    );
}
