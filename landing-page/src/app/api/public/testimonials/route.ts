import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicApiError } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ success: true, data: testimonials });
  } catch (error: unknown) {
    return publicApiError("testimonials", error, "Failed to load testimonials");
  }
}
