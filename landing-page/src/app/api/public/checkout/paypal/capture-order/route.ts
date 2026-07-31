import { NextRequest, NextResponse } from "next/server";
import {
  createPaidEcomOrderAndDecrementStock,
  getPayPalAccessToken,
  parseCheckoutItems,
  parseCustomerInfo,
  resolveCheckoutItems,
} from "@/lib/checkout";
import { getErrorMessage } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = typeof body.orderID === "string" ? body.orderID : "";

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing PayPal order ID" }, { status: 400 });
    }

    const checkoutItems = parseCheckoutItems(body.items);
    const customerInfo = parseCustomerInfo(body.customerInfo);

    const accessToken = await getPayPalAccessToken();
    const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const captureData = await captureResponse.json();

    if (!captureResponse.ok || captureData.status !== "COMPLETED") {
      console.error("PayPal Capture Failed:", captureData);
      return NextResponse.json({ success: false, error: "Payment not completed" }, { status: 400 });
    }

    const { totalTzs, orderItems } = await resolveCheckoutItems(checkoutItems);
    const order = await createPaidEcomOrderAndDecrementStock({
      customerInfo,
      totalTzs,
      paymentMethod: "PAYPAL",
      paymentRef: captureData.id ?? orderId,
      orderItems,
    });

    return NextResponse.json({ success: true, data: { id: order.orderNumber } });
  } catch (error: unknown) {
    console.error("[PUBLIC/checkout/paypal/capture] Error:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}
