import { NextResponse } from "next/server";
import { CATALOGUE_MAX_PAGE_SIZE, CATALOGUE_PAGE_SIZE } from "@/config/catalogue";
import { prisma } from "@/lib/prisma";
import { parseBoundedInt } from "@/lib/publicApi";
import { getReviewSummary } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/** Returns the active flash sale campaign if one is running right now. */
async function getActiveFlashSale() {
  const now = new Date();
  return prisma.flashSale.findFirst({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { endDate: "asc" },
  });
}

// GET /api/public/products
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const featured = searchParams.get("featured") === "true" ? true : undefined;
    const trending = searchParams.get("trending") === "true" ? true : undefined;
    const bestSeller = searchParams.get("bestSeller") === "true" ? true : undefined;
    const isNew = searchParams.get("isNew") === "true" ? true : undefined;
    const flashSale = searchParams.get("flashSale") === "true";
    const categorySlug = searchParams.get("category") || undefined;
    const brandSlug = searchParams.get("brand") || undefined;
    const search = searchParams.get("search") || undefined;
    const minPrice = searchParams.get("minPrice") ? parseFloat(searchParams.get("minPrice")!) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseFloat(searchParams.get("maxPrice")!) : undefined;
    const inStock = searchParams.get("inStock") === "true" ? true : undefined;
    const latest = searchParams.get("latest") === "true";
    const sort = searchParams.get("sort") || undefined;
    const minRating = searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : undefined;
    const page = parseBoundedInt(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const limit = parseBoundedInt(searchParams.get("limit"), CATALOGUE_PAGE_SIZE, 1, CATALOGUE_MAX_PAGE_SIZE);
    const skip = (page - 1) * limit;

    // Resolve active flash sale campaign (used for filtering & metadata)
    const activeCampaign = flashSale ? await getActiveFlashSale() : null;

    const where: Record<string, unknown> = {
      status: "PUBLISHED",
      deletedAt: null,
      ...(featured !== undefined && { featured }),
      ...(trending !== undefined && { trending }),
      ...(bestSeller !== undefined && { bestSeller }),
      ...(isNew !== undefined && { isNew }),
      // flashSale=true: return products with a discount (any type, value > 0)
      ...(flashSale && {
        discountValue: { gt: 0 },
      }),
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
          { brand: { is: { name: { contains: search, mode: "insensitive" } } } },
        ],
      }),
      ...(categorySlug && {
        category: { slug: categorySlug },
      }),
      ...(brandSlug && {
        brand: { name: { equals: brandSlug.replace(/-/g, " "), mode: "insensitive" as const } },
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
          brand: { select: { id: true, name: true } },
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

    const data = products.map((product) => {
      const { reviews, ...rest } = product;

      return {
        ...rest,
        ...getReviewSummary(reviews),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        // Flash sale campaign info for the countdown timer
        flashSaleCampaign: activeCampaign
          ? {
              title: activeCampaign.title,
              endDate: activeCampaign.endDate.toISOString(),
              discountPercentage: Number(activeCampaign.discountPercentage),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[PUBLIC/products] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load products" },
      { status: 500 },
    );
  }
}
