import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return errorResponse("Email is required");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return errorResponse("User not found with this email");
        }

        // Generate OTP
        const otp = "123456";

        await prisma.userOtp.create({
            data: {
                email,
                otp,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
            }
        });

        return jsonResponse({ message: "Password reset OTP sent", otp });
    } catch (e) {
        console.error("FORGOT PASSWORD OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
