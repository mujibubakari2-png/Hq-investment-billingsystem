import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [productCount, orderCount] = await Promise.all([
      prisma.product.count({ where: { status: "PUBLISHED", deletedAt: null } }),
      prisma.ecomOrder.count({ where: { deletedAt: null } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        products: productCount,
        orders: orderCount,
        // Static values configurable by admin via settings
        customers: 5000,
        yearsInBusiness: new Date().getFullYear() - 2020,
      },
    });
  } catch (error) {
    console.error("[PUBLIC/stats] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
