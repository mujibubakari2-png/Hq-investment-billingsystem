import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail, publicApiError } from "@/lib/publicApi";

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail } = await req.json();
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
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
  } catch (error: unknown) {
    return publicApiError("newsletter", error, "Subscription failed");
  }
}
