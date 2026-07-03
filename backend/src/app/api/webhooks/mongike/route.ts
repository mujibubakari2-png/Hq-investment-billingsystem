/**
 * POST /api/webhooks/mongike
 * Mongike payment callback handler (tenant hotspot/PPPoE payments).
 *
 * CRIT-BUG FIX: rateLimitMiddleware is now properly awaited.
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/lib/payments/service";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  const limited = await rateLimitMiddleware(req);
  if (limited) return limited;

  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    const result = await paymentService.processWebhook("MONGIKE", headers, rawBody, null, { skipLicense: true });

    if (!result.processed && result.message?.includes("rejected")) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    return NextResponse.json({ message: result.message, status: result.status }, { status: 200 });

  } catch (e) {
    logger.error("[WEBHOOK/MONGIKE] Unhandled error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
