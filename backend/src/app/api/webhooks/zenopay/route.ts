/**
 * POST /api/webhooks/zenopay
 * ZenoPay payment callback handler (tenant hotspot/PPPoE payments).
 *
 * CRIT-BUG FIX: rateLimitMiddleware is now properly awaited.
 * Previously: `const limited = rateLimitMiddleware(req)` always returned
 * a Promise (truthy), making EVERY request appear rate-limited. The fix
 * ensures rate limiting actually runs before processing the webhook.
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/lib/payments/service";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  // FIXED: await the async rateLimitMiddleware
  const limited = await rateLimitMiddleware(req);
  if (limited) return limited;

  try {
    const rawBody = await req.text();

    // Normalize headers to lowercase for consistent provider signature verification
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    const result = await paymentService.processWebhook("ZENOPAY", headers, rawBody, null, { skipLicense: true });

    if (!result.processed && result.message?.includes("rejected")) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    return NextResponse.json({ message: result.message, status: result.status }, { status: 200 });

  } catch (e) {
    logger.error("[WEBHOOK/ZENOPAY] Unhandled error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
