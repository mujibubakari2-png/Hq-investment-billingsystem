import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicApiError } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim() || undefined;

  try {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true, ...(category && { category }) },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ success: true, data: faqs });
  } catch (error: unknown) {
    return publicApiError("faqs", error, "Failed to load FAQs");
  }
}
