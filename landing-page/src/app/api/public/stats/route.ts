import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicApiError } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

const ESTIMATED_CUSTOMERS = 5000;
const BUSINESS_START_YEAR = 2020;

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
        customers: ESTIMATED_CUSTOMERS,
        yearsInBusiness: new Date().getFullYear() - BUSINESS_START_YEAR,
      },
    });
  } catch (error: unknown) {
    return publicApiError("stats", error, "Failed to load stats");
  }
}
