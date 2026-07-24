import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ success: true, data: testimonials });
  } catch (error) {
    console.error("[PUBLIC/testimonials] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load testimonials" },
      { status: 500 }
    );
  }
}
