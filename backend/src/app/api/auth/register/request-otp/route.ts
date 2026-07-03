import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { generateAndStoreOtp } from "@/lib/otp";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return errorResponse("Email is required");
        }

        const db = getTenantClient(null);
        const existing = await db.user.findUnique({ where: { email } });
        if (existing) {
            return errorResponse("Email is already registered");
        }

        // SEC-003 FIX: generateAndStoreOtp() bcrypt-hashes before DB write
        const { code } = await generateAndStoreOtp(email, null);

        const emailResult = await sendOtpEmail(email, code, 'registration');

        if (!emailResult.success) {
            // emailResult.error is already a string — no instanceof needed
            logger.error("[AUTH] Failed to send registration OTP", { error: String(emailResult.error) });
            return errorResponse(
                `Email error: ${emailResult.error}. Please check your SMTP settings in your .env file.`,
                500
            );
        }

        return jsonResponse({
            message: "Verification code sent to your email.",
        });
    } catch (e: any) {
        logger.error("[AUTH] Register OTP error", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
