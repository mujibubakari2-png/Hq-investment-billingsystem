import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/public/products/search?q=term&limit=6
// Used by Navbar autocomplete
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") ?? "6", 10)));

    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
          { brand: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        brand: true,
        price: true,
        currency: true,
        category: { select: { name: true, slug: true } },
        images: {
          where: { isFeatured: true },
          take: 1,
          select: { url: true },
        },
      },
    });

    const data = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      price: Number(p.price),
      currency: p.currency,
      category: p.category?.name ?? null,
      categorySlug: p.category?.slug ?? null,
      image: p.images[0]?.url ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[PUBLIC/products/search] Error:", error);
    return NextResponse.json(
      { success: false, error: "Search failed" },
      { status: 500 }
    );
  }
}
