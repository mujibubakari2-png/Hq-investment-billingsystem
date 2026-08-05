import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBoundedInt } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/brands
 * Returns active brands with product counts for the BrandCarousel component.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseBoundedInt(searchParams.get("limit"), 20, 1, 50);

    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: limit,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        description: true,
        _count: {
          select: { products: true },
        },
      },
    });

    const data = brands.map((b) => ({
      id: b.id,
      name: b.name,
      // Map logoUrl → logo to match BrandCarousel's Brand interface
      logo: b.logoUrl ?? null,
      slug: b.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: b.description ?? null,
      _count: { products: b._count.products },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[PUBLIC/brands] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load brands" },
      { status: 500 },
    );
  }
}
