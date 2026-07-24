import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcDiscountedPrice } from "@/lib/utils";

// Generate PayPal access token (in a real app, you'd extract this to a shared util)
async function generateAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const appSecret = process.env.PAYPAL_SECRET;
  const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

  if (!clientId || !appSecret) {
    throw new Error("Missing PayPal credentials");
  }

  const auth = Buffer.from(`${clientId}:${appSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await response.json();
  return data.access_token;
}

function generateOrderNumber() {
  const prefix = "ORD";
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${randomStr}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderID, items, customerInfo } = body;

    if (!orderID || !items || !customerInfo) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const accessToken = await generateAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

    // Capture the payment on PayPal
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const captureData = await captureResponse.json();

    if (captureData.status === "COMPLETED") {
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

      // Create Order in Database
      const order = await prisma.ecomOrder.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone,
          shippingAddress: customerInfo.address ? {
            street: customerInfo.address,
            city: customerInfo.city,
          } : undefined,
          totalAmount: totalTzs,
          status: "PENDING", // Ecom order status (processing)
          paymentMethod: "PAYPAL",
          paymentStatus: "COMPLETED",
          paymentRef: captureData.id,
          items: {
            create: orderItemsToCreate,
          },
        },
      });

      // Update product inventory quantities
      for (const item of orderItemsToCreate) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity },
          },
        });
      }

      return NextResponse.json({ success: true, data: { id: order.orderNumber } });
    } else {
      console.error("PayPal Capture Failed:", captureData);
      return NextResponse.json({ success: false, error: "Payment not completed" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[PUBLIC/checkout/paypal/capture] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
