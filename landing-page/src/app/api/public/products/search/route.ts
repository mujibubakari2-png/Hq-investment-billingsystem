import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBoundedInt, publicApiError } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

// GET /api/public/products/search?q=term&limit=6
// Used by Navbar autocomplete
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = parseBoundedInt(searchParams.get("limit"), 6, 1, 10);

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

    const data = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      price: Number(product.price),
      currency: product.currency,
      category: product.category?.name ?? null,
      categorySlug: product.category?.slug ?? null,
      image: product.images[0]?.url ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return publicApiError("products/search", error, "Search failed");
  }
}
