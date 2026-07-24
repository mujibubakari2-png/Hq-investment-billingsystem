import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { isActive: true },
      create: { email },
    });

    return NextResponse.json({
      success: true,
      message: "Subscribed successfully!",
    });
  } catch (error) {
    console.error("[PUBLIC/newsletter] Error:", error);
    return NextResponse.json(
      { success: false, error: "Subscription failed" },
      { status: 500 }
    );
  }
}
