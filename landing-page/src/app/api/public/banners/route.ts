import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicApiError } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      },
      orderBy: { position: "asc" },
    });
    return NextResponse.json({ success: true, data: banners });
  } catch (error: unknown) {
    return publicApiError("banners", error, "Failed to load banners");
  }
}
