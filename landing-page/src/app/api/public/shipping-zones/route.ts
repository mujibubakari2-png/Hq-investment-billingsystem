import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/shipping-zones
 * Returns active shipping zones for the checkout page.
 * Query params: city (optional, for future per-city matching)
 */
export async function GET() {
  try {
    const zones = await prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: { rate: "asc" },
      select: {
        id: true,
        name: true,
        rate: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: zones.map((z) => ({
        id: z.id,
        name: z.name,
        rate: Number(z.rate),
      })),
    });
  } catch (error) {
    console.error("[PUBLIC/shipping-zones] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load shipping zones" },
      { status: 500 },
    );
  }
}
