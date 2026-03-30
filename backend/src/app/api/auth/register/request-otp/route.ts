import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import nodemailer from "nodemailer";

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
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
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
            subject: "Your Registration Verification Code",
            text: `Your verification code is: ${otp}. It will expire in 30 minutes.`,
            html: `<div style="font-family: sans-serif; padding: 20px;">
                    <h2>HQ INVESTMENT Verification</h2>
                    <p>Thank you for registering. Your 6-digit verification code is:</p>
                    <h3 style="background-color: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 2px;">${otp}</h3>
                    <p>This code will expire in 30 minutes.</p>
                   </div>`
        };

        // Attempt to send email
        try {
            await transporter.sendMail(mailOptions);
            console.log("Email sent successfully to", email);
        } catch (mailError) {
            console.error("Failed to send OTP via email. Check SMTP settings:", mailError);
        }

        return jsonResponse({ message: "OTP process initated", otp });
    } catch (e: any) {
        console.error("REGISTER OTP ERROR:", e);
        return errorResponse(e.message || "Internal server error", 500);
    }
}
