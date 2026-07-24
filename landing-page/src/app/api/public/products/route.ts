import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/public/products
// Query params:
//   featured=true|false
//   trending=true|false
//   latest=true        → sort by createdAt desc
//   bestSeller=true
//   category=slug
//   search=term        → name, tags
//   minPrice=number
//   maxPrice=number
//   minRating=1-5
//   inStock=true       → quantity > 0
//   page=1
//   limit=12
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const featured = searchParams.get("featured") === "true" ? true : undefined;
    const trending = searchParams.get("trending") === "true" ? true : undefined;
    const bestSeller =
      searchParams.get("bestSeller") === "true" ? true : undefined;
    const isNew = searchParams.get("isNew") === "true" ? true : undefined;
    const categorySlug = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;
    const minPrice = searchParams.get("minPrice")
      ? parseFloat(searchParams.get("minPrice")!)
      : undefined;
    const maxPrice = searchParams.get("maxPrice")
      ? parseFloat(searchParams.get("maxPrice")!)
      : undefined;
    const inStock = searchParams.get("inStock") === "true" ? true : undefined;
    const latest = searchParams.get("latest") === "true";
    const sort = searchParams.get("sort") || undefined; // price-asc | price-desc | discount | popular
    const minRating = searchParams.get("minRating")
      ? parseFloat(searchParams.get("minRating")!)
      : undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "12", 10))
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      status: "PUBLISHED",
      deletedAt: null,
      ...(featured !== undefined && { featured }),
      ...(trending !== undefined && { trending }),
      ...(bestSeller !== undefined && { bestSeller }),
      ...(isNew !== undefined && { isNew }),
      ...(inStock && { quantity: { gt: 0 } }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            price: {
              ...(minPrice !== undefined && { gte: minPrice }),
              ...(maxPrice !== undefined && { lte: maxPrice }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { tags: { has: search } },
          { description: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categorySlug && {
        category: { slug: categorySlug },
      }),
    };

    const orderBy = latest
      ? [{ createdAt: "desc" as const }]
      : sort === "price-asc"
        ? [{ price: "asc" as const }]
        : sort === "price-desc"
          ? [{ price: "desc" as const }]
          : sort === "discount"
            ? [{ discountValue: "desc" as const }, { createdAt: "desc" as const }]
            : sort === "popular" || trending
              ? [{ viewCount: "desc" as const }]
              : [{ featured: "desc" as const }, { createdAt: "desc" as const }];

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
          reviews: {
            where: { isApproved: true },
            select: { rating: true },
          },
        },
      }),
    ]);

    // Compute average rating
    const data = products.map((p: any) => {
      const avgRating =
        p.reviews.length > 0
          ? p.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / p.reviews.length
          : 0;
      const { reviews, ...rest } = p;
      return {
        ...rest,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PUBLIC/products] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 }
    );
  }
}
