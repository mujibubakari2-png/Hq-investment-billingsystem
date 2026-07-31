import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/utils";

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const authorName = typeof body.authorName === "string" ? body.authorName.trim() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const ratingNum = Number.parseInt(String(body.rating), 10);

    if (!productId || !authorName || !comment || !Number.isInteger(ratingNum)) {
      return NextResponse.json(
        { success: false, error: "Product, name, rating, and review comment are required" },
        { status: 400 },
      );
    }

    if (ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 },
      );
    }

    const review = await prisma.review.create({
      data: {
        productId,
        authorName,
        email: optionalText(body.email),
        rating: ratingNum,
        title: optionalText(body.title),
        comment,
        isApproved: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Review submitted. It will appear after approval.",
      data: { id: review.id },
    });
  } catch (error: unknown) {
    console.error("[PUBLIC/reviews] Error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Failed to submit review") },
      { status: 500 },
    );
  }
}
