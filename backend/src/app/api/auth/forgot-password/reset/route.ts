import { NextRequest } from "next/server";
import { errorResponse, jsonResponse, hashPassword } from "@/lib/auth";
import { verifyAndConsumeOtp } from "@/lib/otp";
import { checkRateLimit } from "@/lib/rateLimiter";
import { getTenantClient } from "@/lib/tenantPrisma";

export async function POST(req: NextRequest) {
    try {
        const rateLimitResponse = await checkRateLimit(req);
        if (rateLimitResponse) return rateLimitResponse;

        const { email, password, otp } = await req.json();

        if (!email || !password || !otp) {
            return errorResponse("Missing required fields");
        }

        if (password.length < 8) {
            return errorResponse("Password must be at least 8 characters", 400);
        }

        // SEC-003 FIX: verifyAndConsumeOtp() uses bcrypt.compare against stored hash
        // and atomically marks OTP as used on success
        const valid = await verifyAndConsumeOtp(email, otp);

        if (!valid) {
            return errorResponse("Invalid or expired OTP", 400);
        }

        // Hash new password
        const hashedPassword = await hashPassword(password);

        // Update user
        const db = getTenantClient(null);
        await db.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        return jsonResponse({ message: "Password reset successfully" });
    } catch (e) {
        console.error("RESET PASSWORD ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
