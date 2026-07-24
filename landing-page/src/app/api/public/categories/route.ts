import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            products: { where: { status: "PUBLISHED", deletedAt: null } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("[PUBLIC/categories] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load categories" },
      { status: 500 }
    );
  }
}
