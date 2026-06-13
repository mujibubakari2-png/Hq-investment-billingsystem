import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { generateAndStoreOtp } from "@/lib/otp";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const identifier = body.email || body.phone || body.identifier;

        if (!identifier) {
            return errorResponse("Email or phone is required");
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier }
                ]
            }
        });

        if (!user) {
            // SEC-003: Return same message whether user exists or not (prevents enumeration)
            return jsonResponse({ message: "If an account exists, a password reset OTP has been sent." });
        }

        const email = user.email || identifier;

        // SEC-003 FIX: generateAndStoreOtp() hashes before DB write — code is only in email
        const { code } = await generateAndStoreOtp(email, user.tenantId);

        const emailResult = await sendOtpEmail(email, code, 'password-reset');

        if (!emailResult.success) {
            console.error(`[AUTH] Failed to send password reset OTP to ${email}:`, emailResult.error);
            return errorResponse(
                `Email error: ${emailResult.error}. Please check your SMTP settings.`,
                500
            );
        }

        return jsonResponse({
            message: "If an account exists, a password reset OTP has been sent.",
        });
    } catch (e) {
        console.error("FORGOT PASSWORD OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
