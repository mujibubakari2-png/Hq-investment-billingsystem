import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;

  try {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true, ...(category && { category }) },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ success: true, data: faqs });
  } catch (error) {
    console.error("[PUBLIC/faqs] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load FAQs" },
      { status: 500 }
    );
  }
}
