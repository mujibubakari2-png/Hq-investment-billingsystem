import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { generateAndStoreOtp } from "@/lib/otp";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const identifier = body.email || body.phone || body.identifier;

        if (!identifier) {
            return errorResponse("Email or phone is required");
        }

        const db = getTenantClient(null);
        const user = await db.user.findFirst({
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
            // emailResult.error is already a string — no instanceof needed
            logger.error("[AUTH] Failed to send password reset OTP", { error: String(emailResult.error) });
            return errorResponse(
                `Email error: ${emailResult.error}. Please check your SMTP settings.`,
                500
            );
        }

        return jsonResponse({
            message: "If an account exists, a password reset OTP has been sent.",
        });
    } catch (e) {
        logger.error("[AUTH] Forgot-password OTP error", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
