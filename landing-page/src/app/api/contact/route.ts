import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail, publicApiError } from "@/lib/publicApi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = normalizeEmail(body.email);
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !isValidEmail(email) || !message) {
      return NextResponse.json(
        { success: false, error: "Name, valid email, and message are required" },
        { status: 400 },
      );
    }

    await prisma.contactMessage.create({
      data: { name, email, message },
    });

    return NextResponse.json({ success: true, message: "Message sent successfully" });
  } catch (error: unknown) {
    return publicApiError("contact", error, "Failed to send message");
  }
}
