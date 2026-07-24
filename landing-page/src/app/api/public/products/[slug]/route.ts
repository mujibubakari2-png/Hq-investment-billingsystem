import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/public/products/[slug]
// Returns full product detail with reviews and related products
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const product = await prisma.product.findFirst({
      where: { slug, status: "PUBLISHED", deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: {
          orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
        },
        reviews: {
          where: { isApproved: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Increment view count (fire-and-forget)
    prisma.product
      .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    // Calculate avg rating
    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / product.reviews.length
        : 0;

    // Related products (same category, excluding current)
    let related: typeof product[] = [];
    if (product.categoryId) {
      related = await prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          id: { not: product.id },
          status: "PUBLISHED",
          deletedAt: null,
        },
        take: 8,
        orderBy: [{ featured: "desc" }, { viewCount: "desc" }],
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
      });
    }

    const relatedWithRating = related.map((p: any) => {
      const avg =
        p.reviews.length > 0
          ? p.reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / p.reviews.length
          : 0;
      const { reviews, ...rest } = p;
      return {
        ...rest,
        avgRating: Math.round(avg * 10) / 10,
        reviewCount: reviews.length,
      };
    });

    const { reviews, ...productRest } = product;
    const data = {
      ...productRest,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      reviews,
      related: relatedWithRating,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[PUBLIC/products/[slug]] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load product" },
      { status: 500 }
    );
  }
}
