import { NextRequest } from "next/server";
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
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
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
            
            const isDev = process.env.NODE_ENV === 'development';
            if (!isDev) {
                return errorResponse(
                    "Failed to send password reset email. Please check your system email configuration (SMTP).", 
                    500
                );
            }
        }

        // For TestSprite/Automation
        const isAutomation = req.headers.get("x-automation-key") === process.env.AUTOMATION_KEY || process.env.NODE_ENV === "development";

        return jsonResponse({ 
            message: "Password reset OTP sent to your email.", 
            otp: isAutomation ? otp : undefined 
        });
    } catch (e) {
        console.error("FORGOT PASSWORD OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
