/**
 * POST /api/webhooks/harakapay
 * HarakaPay payment callback handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/lib/payments/service";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";

export async function POST(req: NextRequest) {
  const limited = rateLimitMiddleware(req);
  if (limited) return limited;

  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => { headers[key] = value; });

    const result = await paymentService.processWebhook("HARAKAPAY", headers, rawBody);

    if (!result.processed && result.message?.includes("rejected")) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    return NextResponse.json({ message: result.message, status: result.status }, { status: 200 });

  } catch (e) {
    console.error("[WEBHOOK/HARAKAPAY] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
