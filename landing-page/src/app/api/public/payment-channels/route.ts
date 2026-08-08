import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/payment-channels
 * Returns active payment channels for the storefront checkout page.
 * Only safe fields are exposed — apiKey, apiSecret, webhookSecret are never returned.
 */
export async function GET() {
  try {
    const channels = await prisma.paymentChannel.findMany({
      where: { tenantId: null, status: "ACTIVE" },
      orderBy: { provider: "asc" },
      select: {
        id: true,
        provider: true,
        name: true,
        environment: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    console.error("[PUBLIC_PAYMENT_CHANNELS_GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load payment channels" },
      { status: 500 }
    );
  }
}

