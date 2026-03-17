import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return errorResponse("Email is required");
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return errorResponse("Email is already registered");
        }

        // Generate a 6-digit OTP (hardcoded for demo purposes as requested)
        const otp = "123456";

        await prisma.userOtp.create({
            data: {
                email,
                otp,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
            }
        });

        return jsonResponse({ message: "OTP sent successfully", otp });
    } catch (e) {
        console.error("REGISTER OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
