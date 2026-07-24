import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcDiscountedPrice } from "@/lib/utils";

// Generate PayPal access token
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
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, customerInfo } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }

    // Recalculate secure total from database prices to prevent client-side tampering
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    let totalTzs = 0;
    
    for (const item of items) {
      const dbProduct = dbProducts.find((p: any) => p.id === item.productId);
      if (!dbProduct) {
        return NextResponse.json({ success: false, error: `Product not found: ${item.name}` }, { status: 400 });
      }
      
      const effectivePrice = calcDiscountedPrice(
        Number(dbProduct.price), 
        dbProduct.discountType, 
        dbProduct.discountValue ? Number(dbProduct.discountValue) : null
      );
      totalTzs += effectivePrice * item.quantity;
    }

    // Convert TZS to USD for PayPal (example rate: 2500)
    // In production, fetch live exchange rate
    const EXCHANGE_RATE = 2500;
    const totalUsd = (totalTzs / EXCHANGE_RATE).toFixed(2);

    const accessToken = await generateAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: totalUsd,
            },
            description: `Order for ${customerInfo?.name || 'Customer'}`,
          },
        ],
      }),
    });

    const order = await response.json();

    if (order.id) {
      return NextResponse.json({ success: true, id: order.id });
    } else {
      console.error("PayPal Create Order Error:", order);
      return NextResponse.json({ success: false, error: "Failed to create PayPal order" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[PUBLIC/checkout/paypal/create] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
