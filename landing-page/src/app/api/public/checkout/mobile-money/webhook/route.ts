import { NextRequest, NextResponse } from "next/server";
import { normalizeMobileMoneyProvider, markOrderPaidAndDecrementStock } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualStr } from "@/lib/payments";

/**
* ECOM-WEBHOOK-001 FIX
*
* PROBLEM: This endpoint is public (no session/auth) and marks an order PAID
* + decrements stock as soon as it receives { order_id, payment_status }.
* The signature check below only ran for ZENOPAY / MONGIKE / HARAKAPAY —
 * PALMPESA (the default, most-used provider in the checkout UI) was NOT
* checked at all. Anyone who knew (or guessed) an order number could call
*   POST /api/public/checkout/mobile-money/webhook?provider=PALMPESA
*   { "order_id": "<orderNumber>", "payment_status": "COMPLETED" }
 * with zero authentication and get the order marked paid — free goods,
* no payment ever made.
*
* FIX: PalmPesa's own callback carries no signature (per official docs), so a
 * shared-secret header check can't be relied on for it. Instead, for PALMPESA
* we independently confirm the payment status directly with PalmPesa's own
* server (POST /api/order-status, authenticated with our merchant API key)
* before trusting the webhook body — the same pattern already used by the
* backend's PalmPesaProvider.checkStatus(). This can't be spoofed by a caller
* who doesn't have the merchant API key.
 */
async function verifyPalmPesaStatus(apiUrl: string, apiKey: string, orderId: string): Promise<boolean> {
try {
const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/order-status`, {
            method: "POST",
    headers: {
    "Content-Type": "application/json",
        Accept: "application/json",
                Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ order_id: orderId }),
});
const data = await res.json();
const inner = Array.isArray(data?.data) ? data.data[0] ?? {} : data ?? {};
        const rawStatus = String(inner?.payment_status ?? "").trim().toUpperCase();
return rawStatus === "COMPLETED" || rawStatus === "SUCCESS";
    } catch {
        return false; // fail closed — unverifiable status is treated as NOT paid
    }
}

export async function POST(req: NextRequest) {
    try {
        const provider = normalizeMobileMoneyProvider(req.nextUrl.searchParams.get("provider"));
        const channel = await prisma.paymentChannel.findFirst({
            where: { provider, status: "ACTIVE", tenantId: null },
        });

        if (!channel || !channel.apiKey) {
            return NextResponse.json({ error: "Payment channel not configured" }, { status: 500 });
        }

        const { decrypt } = await import("@/lib/encryption");
        const apiKey = decrypt(channel.apiKey) || "";
        const incomingKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "") || "";

        if (provider === "ZENOPAY" || provider === "MONGIKE" || provider === "HARAKAPAY") {
            if (!incomingKey || !timingSafeEqualStr(incomingKey, apiKey)) {
                return NextResponse.json({ error: "Unauthorized webhook signature" }, { status: 401 });
            }
        }

        const body = await req.json();
        const orderNumber = body.order_id || body.transaction_id;
        const rawStatus = String(body.payment_status || body.status || "").toUpperCase();

        if (!orderNumber) {
            return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
        }

        const isSuccess = rawStatus === "COMPLETED" || rawStatus === "SUCCESS";
        if (!isSuccess) {
            console.log(`[MOBILE MONEY WEBHOOK] Ignored non-success status ${rawStatus} for order ${orderNumber}`);
            return NextResponse.json({ success: true, message: "Ignored non-success status" });
        }

        // ECOM-WEBHOOK-001: PalmPesa sends no verifiable signature, so its webhook
        // body alone is not trustworthy — confirm with PalmPesa's own API first.
        if (provider === "PALMPESA") {
            const channelConfig = channel.config as { apiUrl?: string } | null;
            const apiUrl = channelConfig?.apiUrl || process.env.PALMPESA_API_URL || "https://palmpesa.drmlelwa.co.tz";
            const confirmed = await verifyPalmPesaStatus(apiUrl, apiKey, String(orderNumber));
            if (!confirmed) {
                console.warn(`[MOBILE MONEY WEBHOOK] PalmPesa status could not be independently confirmed for order ${orderNumber} — refusing to mark as paid`);
                return NextResponse.json({ error: "Payment could not be verified with provider" }, { status: 401 });
            }
        }

        const result = await markOrderPaidAndDecrementStock(String(orderNumber));

    if (result.alreadyCompleted) {
      return NextResponse.json({ success: true, message: "Order already marked as completed" });
    }

    console.log(`[MOBILE MONEY WEBHOOK] Successfully processed payment for order ${orderNumber}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[MOBILE MONEY WEBHOOK] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
