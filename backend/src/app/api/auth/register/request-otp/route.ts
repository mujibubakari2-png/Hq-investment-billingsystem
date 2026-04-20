import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";

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

        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await prisma.userOtp.create({
            data: {
                email,
                otp,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
            }
        });

        // Send the email
        const emailResult = await sendOtpEmail(email, otp, 'registration');

        if (!emailResult.success) {
            // Log full error internally
            console.error(`[AUTH] Failed to send registration OTP to ${email}:`, emailResult.error);
            
            // In development, we might still want to return success for testing
            const isDev = process.env.NODE_ENV === 'development';
            if (!isDev) {
                return errorResponse(
                    "Failed to send verification email. Please check your system email configuration (SMTP).", 
                    500
                );
            }
        }

        return jsonResponse({ 
            message: "Verification code sent to your email.", 
            // In dev mode, return OTP for easy testing without working email
            otp: process.env.NODE_ENV === 'development' ? otp : undefined 
        });
    } catch (e: any) {
        console.error("REGISTER OTP ERROR:", e);
        return errorResponse(e.message || "Internal server error", 500);
    }
}
