import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/public/coupons/validate
 * Validates a coupon code and returns the discount details.
 * Body: { code: string, subtotal: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    const subtotal = typeof body?.subtotal === "number" ? body.subtotal : 0;

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Coupon code is required" },
        { status: 400 },
      );
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        isActive: true,
      },
    });

    // Does not exist or is inactive
    if (!coupon) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired coupon code" },
        { status: 404 },
      );
    }

    // Check expiry date
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return NextResponse.json(
        { success: false, error: "This coupon has expired" },
        { status: 400 },
      );
    }

    // Check usage limit
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json(
        { success: false, error: "This coupon has reached its usage limit" },
        { status: 400 },
      );
    }

    // Calculate discount amount
    const discountAmount = Number(coupon.discountAmount);
    let discount = 0;

    if (coupon.discountType === "percent") {
      discount = Math.min(subtotal, (subtotal * discountAmount) / 100);
    } else {
      // fixed
      discount = Math.min(subtotal, discountAmount);
    }

    const discountFormatted = Math.round(discount * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: discountAmount,
        discountApplied: discountFormatted,
        newTotal: Math.max(0, subtotal - discountFormatted),
        message:
          coupon.discountType === "percent"
            ? `${discountAmount}% discount applied`
            : `${discountAmount} off applied`,
      },
    });
  } catch (error) {
    console.error("[PUBLIC/coupons/validate] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to validate coupon" },
      { status: 500 },
    );
  }
}
