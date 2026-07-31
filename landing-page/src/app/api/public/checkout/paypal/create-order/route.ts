import { NextRequest, NextResponse } from "next/server";
import { getPayPalAccessToken, parseCheckoutItems, resolveCheckoutItems } from "@/lib/checkout";
import { getErrorMessage } from "@/lib/utils";

const TZS_TO_USD_RATE = 2500;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const checkoutItems = parseCheckoutItems(body.items);
    const { totalTzs } = await resolveCheckoutItems(checkoutItems);

    const accessToken = await getPayPalAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";
    const totalUsd = (totalTzs / TZS_TO_USD_RATE).toFixed(2);

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
            description: "HQ Investment order",
          },
        ],
      }),
    });

    const order = await response.json();

    if (!response.ok || !order.id) {
      console.error("PayPal Create Order Error:", order);
      return NextResponse.json({ success: false, error: "Failed to create PayPal order" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: order.id });
  } catch (error: unknown) {
    console.error("[PUBLIC/checkout/paypal/create] Error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
