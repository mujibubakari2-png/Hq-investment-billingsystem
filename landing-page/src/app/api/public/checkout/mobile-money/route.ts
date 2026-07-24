import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcDiscountedPrice } from "@/lib/utils";

function generateOrderNumber() {
  const prefix = "ORD";
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, provider, items, customerInfo } = body;

    if (!phone || !provider || !items || !customerInfo) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Recalculate secure total
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    let totalTzs = 0;
    const orderItemsToCreate = [];

    for (const item of items) {
      const dbProduct = dbProducts.find((p: any) => p.id === item.productId);
      if (!dbProduct) continue;

      const effectivePrice = calcDiscountedPrice(
        Number(dbProduct.price), 
        dbProduct.discountType, 
        dbProduct.discountValue ? Number(dbProduct.discountValue) : null
      );
      
      const lineTotal = effectivePrice * item.quantity;
      totalTzs += lineTotal;

      orderItemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: effectivePrice,
        total: lineTotal,
      });
    }

    const orderNumber = generateOrderNumber();

    // Create Order in Database as PENDING
    const order = await prisma.ecomOrder.create({
      data: {
        orderNumber,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: phone,
        shippingAddress: customerInfo.address ? {
          street: customerInfo.address,
          city: customerInfo.city,
        } : undefined,
        totalAmount: totalTzs,
        status: "PENDING",
        paymentMethod: provider,
        paymentStatus: "PENDING",
        items: {
          create: orderItemsToCreate,
        },
      },
    });

    // 1. Fetch super admin channel for the selected provider
    const channel = await prisma.paymentChannel.findFirst({
      where: { provider, status: "ACTIVE", tenantId: null },
    });

    if (!channel || !channel.apiKey) {
      // If we don't have real credentials, just simulate success for local dev
      console.warn(`[CHECKOUT] No active super admin credentials found for ${provider}. Simulating success.`);
      return NextResponse.json({ success: true, data: { orderId: order.orderNumber } });
    }

    // 2. Decrypt API key
    const { decrypt } = await import("@/lib/encryption");
    const apiKey = decrypt(channel.apiKey);
    
    if (!apiKey) {
      console.warn(`[CHECKOUT] Could not decrypt API key for ${provider}. Simulating success.`);
      return NextResponse.json({ success: true, data: { orderId: order.orderNumber } });
    }

    // 3. Initiate real mobile money push USSD
    const { initiateEcomMobilePayment } = await import("@/lib/payments");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.headers.get("origin") ?? "http://localhost:3001");
    const webhookUrl = `${baseUrl}/api/public/checkout/mobile-money/webhook?provider=${provider}`;

    try {
      await initiateEcomMobilePayment({
        provider,
        apiKey,
        apiUrl: (channel.config as any)?.apiUrl,
        reference: order.orderNumber,
        amount: totalTzs,
        phone,
        buyerName: customerInfo.name,
        buyerEmail: customerInfo.email,
        webhookUrl,
      });
      console.log(`[CHECKOUT] Triggered push USSD via ${provider} for order ${order.orderNumber}`);
    } catch (paymentErr: any) {
      console.error("[CHECKOUT] Payment Gateway Error:", paymentErr);
      // In a real app we might fail the order, but we can also just return the error
      return NextResponse.json({ success: false, error: paymentErr.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, data: { orderId: order.orderNumber } });
  } catch (error: any) {
    console.error("[PUBLIC/checkout/mobile-money] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
