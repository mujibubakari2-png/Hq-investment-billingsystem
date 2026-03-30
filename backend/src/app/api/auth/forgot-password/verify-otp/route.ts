import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { email, otp } = await req.json();
        
        if (!email || !otp) {
            return errorResponse("Email and OTP are required");
        }

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

        // Do NOT mark as used yet. It will be consumed when the user actually submits the new password.
        return jsonResponse({ message: "OTP is valid" });
    } catch (e: any) {
        console.error("VERIFY RESET OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
