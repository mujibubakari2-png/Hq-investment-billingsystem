import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/tax-rates
 * Returns the first active tax class rate for checkout calculation.
 * (Most e-commerce stores apply one VAT rate globally)
 */
export async function GET() {
  try {
    const taxClasses = await prisma.taxClass.findMany({
      where: { isActive: true },
      orderBy: { ratePercentage: "desc" },
      select: {
        id: true,
        name: true,
        ratePercentage: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: taxClasses.map((t) => ({
        id: t.id,
        name: t.name,
        ratePercentage: Number(t.ratePercentage),
      })),
      // Convenience: the primary (highest) tax rate to apply
      primaryRate: taxClasses.length > 0 ? Number(taxClasses[0].ratePercentage) : 0,
    });
  } catch (error) {
    console.error("[PUBLIC/tax-rates] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load tax rates" },
      { status: 500 },
    );
  }
}
