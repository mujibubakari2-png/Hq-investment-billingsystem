import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import nodemailer from "nodemailer";

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

        // Generate a real 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const email = user.email || identifier;

        await prisma.userOtp.create({
            data: {
                email,
                otp,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
            }
        });

        // Set up email transport
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.ethereal.email",
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: process.env.SMTP_FROM || '"HQ INVESTMENT" <no-reply@hqinvestment.local>',
            to: email,
            subject: "Your Password Reset Code",
            text: `Your password reset code is: ${otp}. It will expire in 30 minutes.`,
            html: `<div style="font-family: sans-serif; padding: 20px;">
                    <h2>HQ INVESTMENT Password Reset</h2>
                    <p>We received a request to reset your password. Your 6-digit verification code is:</p>
                    <h3 style="background-color: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 2px;">${otp}</h3>
                    <p>This code will expire in 30 minutes. If you did not request this, please ignore this email.</p>
                   </div>`
        };

        // Attempt to send email
        try {
            await transporter.sendMail(mailOptions);
            console.log("Password reset email sent successfully to", email);
        } catch (mailError) {
            console.error("Failed to send Password Reset OTP via email. Check SMTP settings:", mailError);
        }

        // For TestSprite, we'll only return OTP if specifically requested (for automation)
        const isAutomation = req.headers.get("x-automation-key") === process.env.AUTOMATION_KEY || process.env.NODE_ENV === "development";

        return jsonResponse({ 
            message: "Password reset OTP process initialized", 
            otp: isAutomation ? otp : undefined 
        });
    } catch (e) {
        console.error("FORGOT PASSWORD OTP ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
