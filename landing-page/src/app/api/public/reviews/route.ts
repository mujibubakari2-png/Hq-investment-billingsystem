import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, authorName, email, rating, title, comment } = body;

    if (!productId || !authorName || !rating) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ratingNum = parseInt(String(rating), 10);
    if (ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Validate product exists
    const product = await prisma.product.findFirst({
      where: { id: productId, status: "PUBLISHED", deletedAt: null },
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const review = await prisma.review.create({
      data: {
        productId,
        authorName,
        email: email || null,
        rating: ratingNum,
        title: title || null,
        comment: comment || null,
        isApproved: false, // Requires admin approval
      },
    });

    return NextResponse.json({
      success: true,
      message: "Review submitted! It will appear after approval.",
      data: { id: review.id },
    });
  } catch (error) {
    console.error("[PUBLIC/reviews] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit review" },
      { status: 500 }
    );
  }
}
