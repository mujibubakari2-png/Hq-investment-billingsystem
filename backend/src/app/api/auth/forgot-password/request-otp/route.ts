import { NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";

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
            return errorResponse("User not found");
        }

        // Generate a 6-digit OTP
        const otp = randomInt(100000, 1000000).toString();
        const email = user.email || identifier;

        await prisma.userOtp.create({
            data: {
                email,
                otp,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
            }
        });

        // Send the email
        const emailResult = await sendOtpEmail(email, otp, 'password-reset');

        if (!emailResult.success) {
            console.error(`[AUTH] Failed to send password reset OTP to ${email}:`, emailResult.error);
            
            return errorResponse(
                `Email error: ${emailResult.error}. Please check your SMTP settings in your .env file.`, 
                500
            );
        }

        return jsonResponse({ 
            message: "Password reset OTP sent to your email.",
        });
    } catch (e) {
        console.error("FORGOT PASSWORD OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
