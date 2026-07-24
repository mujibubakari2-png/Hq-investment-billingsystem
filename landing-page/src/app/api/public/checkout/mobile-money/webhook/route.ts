import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualStr } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const provider = req.nextUrl.searchParams.get("provider");
    if (!provider) {
      return NextResponse.json({ error: "Missing provider parameter" }, { status: 400 });
    }

    // 1. Fetch the super admin channel for verification
    const channel = await prisma.paymentChannel.findFirst({
      where: { provider, status: "ACTIVE", tenantId: null },
    });

    if (!channel || !channel.apiKey) {
      return NextResponse.json({ error: "Payment channel not configured" }, { status: 500 });
    }

    const { decrypt } = await import("@/lib/encryption");
    const apiKey = decrypt(channel.apiKey) || "";

    // 2. Verify Webhook Signature (Provider specific)
    const incomingKey = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "") || "";
    
    // For Zenopay, Mongike, HarakaPay they usually send the API Key in the headers to verify webhook authenticity
    if (provider === "ZENOPAY" || provider === "MONGIKE" || provider === "HARAKAPAY") {
      if (!incomingKey || !timingSafeEqualStr(incomingKey, apiKey)) {
        return NextResponse.json({ error: "Unauthorized webhook signature" }, { status: 401 });
      }
    }

    const body = await req.json();
    const orderId = body.order_id || body.transaction_id;
    const rawStatus = (body.payment_status || body.status || "").toUpperCase();

    if (!orderId) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    const isSuccess = rawStatus === "COMPLETED" || rawStatus === "SUCCESS";
    if (!isSuccess) {
      console.log(`[MOBILE MONEY WEBHOOK] Ignored non-success status ${rawStatus} for order ${orderId}`);
      return NextResponse.json({ success: true, message: "Ignored non-success status" });
    }

    // 3. Update EcomOrder
    const order = await prisma.ecomOrder.findUnique({
      where: { orderNumber: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.paymentStatus === "COMPLETED") {
      return NextResponse.json({ success: true, message: "Order already marked as completed" });
    }

    // Update the order in a transaction to safely decrement stock
    await prisma.$transaction(async (tx: any) => {
      await tx.ecomOrder.update({
        where: { id: order.id },
        data: {
          status: "PROCESSING",
          paymentStatus: "COMPLETED",
        },
      });

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }
    });

    console.log(`[MOBILE MONEY WEBHOOK] Successfully processed payment for order ${orderId}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[MOBILE MONEY WEBHOOK] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
