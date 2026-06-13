/**
 * POST /api/webhooks/stripe
 * Stripe payment event handler (charge.completed, checkout.session.completed, etc.)
 *
 * Stripe sends HTTPS POST with JSON body + stripe-signature header.
 * We read the raw body BEFORE any JSON parsing — Stripe's HMAC is over the raw bytes.
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/lib/payments/service";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";

export async function POST(req: NextRequest) {
    const limited = rateLimitMiddleware(req);
    if (limited) return limited;

    try {
        // Must use req.text() — JSON.parse() would alter whitespace and break HMAC
        const rawBody = await req.text();
        const headers: Record<string, string> = {};
        req.headers.forEach((value, key) => { headers[key] = value; });

        const result = await paymentService.processWebhook("STRIPE", headers, rawBody);

        if (!result.processed && result.message?.includes("rejected")) {
            return NextResponse.json({ error: result.message }, { status: 401 });
        }

        // Stripe requires a 2xx response within 30 s or it retries
        return NextResponse.json({ received: true, message: result.message }, { status: 200 });

    } catch (e) {
        console.error("[WEBHOOK/STRIPE] Error:", e);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
