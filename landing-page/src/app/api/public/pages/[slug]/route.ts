import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/pages/[slug]
 * Returns a single published custom CMS page created in PagesPage.tsx (Super Admin).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const page = await prisma.customPage.findFirst({
      where: { slug, isPublished: true },
    });

    if (!page) {
      return NextResponse.json(
        { success: false, error: "Page not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[PUBLIC/pages/[slug]] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load page" },
      { status: 500 },
    );
  }
}
