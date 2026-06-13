import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { generateAndStoreOtp } from "@/lib/otp";

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

        // SEC-003 FIX: generateAndStoreOtp() bcrypt-hashes before DB write
        const { code } = await generateAndStoreOtp(email, null);

        const emailResult = await sendOtpEmail(email, code, 'registration');

        if (!emailResult.success) {
            console.error(`[AUTH] Failed to send registration OTP to ${email}:`, emailResult.error);
            return errorResponse(
                `Email error: ${emailResult.error}. Please check your SMTP settings in your .env file.`,
                500
            );
        }

        return jsonResponse({
            message: "Verification code sent to your email.",
        });
    } catch (e: any) {
        console.error("REGISTER OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
