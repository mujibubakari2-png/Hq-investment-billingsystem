import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const { email, otp } = await req.json();

        if (!email || !otp) {
            return errorResponse("Email and OTP are required");
        }

        // SEC-003 FIX: Use bcrypt.compare against stored hash — never plaintext WHERE match
        // Do NOT consume the OTP yet — it is consumed in the /reset route when password is changed
        const match = await verifyOtp(email, otp);

        if (!match) {
            return errorResponse("Invalid or expired OTP", 400);
        }

        return jsonResponse({ message: "OTP is valid" });
    } catch (e: any) {
        logger.error("VERIFY RESET OTP ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
