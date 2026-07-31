import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createEcomOrder,
  normalizeMobileMoneyProvider,
  parseCheckoutItems,
  parseCustomerInfo,
  resolveCheckoutItems,
} from "@/lib/checkout";
import { getErrorMessage } from "@/lib/utils";

interface PaymentChannelConfig {
  apiUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const provider = normalizeMobileMoneyProvider(body.provider);
    const checkoutItems = parseCheckoutItems(body.items);
    const customerInfo = parseCustomerInfo(body.customerInfo);

    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
    }

    const { totalTzs, orderItems } = await resolveCheckoutItems(checkoutItems);
    const channel = await prisma.paymentChannel.findFirst({
      where: { provider, status: "ACTIVE", tenantId: null },
    });

    if (!channel || !channel.apiKey) {
      return NextResponse.json(
        { success: false, error: `${provider} payment channel is not configured` },
        { status: 503 },
      );
    }

    const { decrypt } = await import("@/lib/encryption");
    const apiKey = decrypt(channel.apiKey);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `${provider} payment channel credentials are invalid` },
        { status: 503 },
      );
    }

    const order = await createEcomOrder({
      customerInfo,
      customerPhone: phone,
      totalTzs,
      paymentMethod: provider,
      paymentStatus: "PENDING",
      orderItems,
    });

    const { initiateEcomMobilePayment } = await import("@/lib/payments");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "http://localhost:3001";
    const webhookUrl = `${baseUrl}/api/public/checkout/mobile-money/webhook?provider=${provider}`;
    const channelConfig = channel.config as PaymentChannelConfig | null;

    await initiateEcomMobilePayment({
      provider,
      apiKey,
      apiUrl: channelConfig?.apiUrl,
      reference: order.orderNumber,
      amount: totalTzs,
      phone,
      buyerName: customerInfo.name,
      buyerEmail: customerInfo.email,
      webhookUrl,
    });

    return NextResponse.json({ success: true, data: { orderId: order.orderNumber } });
  } catch (error: unknown) {
    console.error("[PUBLIC/checkout/mobile-money] Error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
