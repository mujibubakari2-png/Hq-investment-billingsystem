import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, isAutomationRequest } from "@/lib/auth";
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
        const otp = randomInt(100000, 1000000).toString();

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
            
            // Return the specific SMTP error to help the user fix their config
            return errorResponse(
                `Email error: ${emailResult.error}. Please check your SMTP settings in your .env file.`, 
                500
            );
        }

        return jsonResponse({
            message: "Verification code sent to your email.",
            otp: isAutomationRequest(req) ? otp : undefined
        });
    } catch (e: any) {
        console.error("REGISTER OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
