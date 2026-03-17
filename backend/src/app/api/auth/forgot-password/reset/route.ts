import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { email, password, otp } = await req.json();

        if (!email || !password || !otp) {
            return errorResponse("Missing required fields");
        }

        // Verify OTP
        const validOtp = await prisma.userOtp.findFirst({
            where: {
                email,
                otp,
                used: false,
                expiresAt: { gt: new Date() }
            }
        });

        if (!validOtp) {
            return errorResponse("Invalid or expired OTP", 400);
        }

        // Mark OTP as used
        await prisma.userOtp.update({
            where: { id: validOtp.id },
            data: { used: true }
        });

        // Hash new password
        const hashedPassword = await hashPassword(password);

        // Update user
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        return jsonResponse({ message: "Password reset successfully" });
    } catch (e) {
        console.error("RESET PASSWORD ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
