import { NextRequest, NextResponse } from "next/server";
import { normalizeMobileMoneyProvider, markOrderPaidAndDecrementStock } from "@/lib/checkout";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualStr } from "@/lib/payments";

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
