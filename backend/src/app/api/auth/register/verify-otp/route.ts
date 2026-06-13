import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { verifyAndConsumeOtp } from "@/lib/otp";

export async function POST(req: NextRequest) {
    try {
        const { email, otp } = await req.json();

        if (!email || !otp) {
            return errorResponse("Email and OTP are required");
        }

        // SEC-003 FIX: verifyAndConsumeOtp() bcrypt-compares submitted code
        // against the stored hash — never does a WHERE otp = plaintext query
        const valid = await verifyAndConsumeOtp(email, otp);

        if (!valid) {
            return errorResponse("Invalid or expired OTP", 400);
        }

        return jsonResponse({ message: "OTP verified successfully" });
    } catch (e: any) {
        console.error("VERIFY OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
