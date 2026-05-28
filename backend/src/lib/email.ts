import nodemailer from "nodemailer";
import { env } from "@/lib/env";

/**
 * Centralized email service for HQ Investment ISP Billing System.
 * Handles OTP and system notifications using SMTP.
 */

export const emailConfig: any = {
    // If SMTP_HOST is not provided, default to smtp.gmail.com
    host: env.SMTP_HOST || "smtp.gmail.com",
    port: Number(env.SMTP_PORT) || 587,
    // Port 465 is always secure (SSL/TLS). Port 587 uses STARTTLS so secure MUST be false
    secure: Number(env.SMTP_PORT) === 465 || env.SMTP_SECURE,
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    },
    family: 4,
    // Add a timeout to fail faster if the network is blocked
    connectionTimeout: 10000, 
    greetingTimeout: 10000
};

console.log(`[EMAIL] SMTP Default Configuration: Host=${emailConfig.host}, Port=${emailConfig.port}, Secure=${emailConfig.secure}`);

export async function sendEmail({
    to,
    subject,
    text,
    html,
}: {
    to: string;
    subject: string;
    text: string;
    html: string;
}) {
    const from = env.SMTP_FROM || `"${env.APP_NAME || "HQ INVESTMENT"}" <${env.SMTP_USER || "no-reply@billing-system.local"}>`;

    console.log(`[EMAIL] Attempting to send email to ${to} (Host: ${emailConfig.host})`);

    let currentPort = Number(env.SMTP_PORT) || 587;
    let alternatePort = currentPort === 587 ? 465 : 587;
    
    let activeTransporter = nodemailer.createTransport({
        ...emailConfig,
        port: currentPort,
        secure: currentPort === 465 || env.SMTP_SECURE
    });

    try {
        // Test connection before sending
        if (env.SMTP_HOST && env.SMTP_HOST !== "smtp.ethereal.email") {
            console.log(`[EMAIL] Verifying connection to ${emailConfig.host}:${currentPort}...`);
            try {
                await activeTransporter.verify();
            } catch (verifyError: any) {
                const networkErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH'];
                if (networkErrors.includes(verifyError.code)) {
                    console.warn(`[EMAIL] Connection failed on port ${currentPort}. Retrying with fallback port ${alternatePort}...`);
                    activeTransporter = nodemailer.createTransport({
                        ...emailConfig,
                        port: alternatePort,
                        secure: alternatePort === 465
                    });
                    await activeTransporter.verify();
                    currentPort = alternatePort;
                } else {
                    throw verifyError;
                }
            }
        }

        const info = await activeTransporter.sendMail({
            from,
            to,
            subject,
            text,
            html,
        });

        console.log(`[EMAIL] Email sent successfully via port ${currentPort}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("[EMAIL] Failed to send email:", error.message);
        console.error("[EMAIL] Error Code:", error.code);
        
        let userFriendlyError = error.message;
        if (error.code === 'EAUTH') {
            userFriendlyError = "Authentication failed. Please verify your SMTP_USER and SMTP_PASS (App Password).";
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
            userFriendlyError = `Could not connect to ${emailConfig.host} on ports 587 or 465. Both are blocked. Check your firewall or DigitalOcean settings.`;
        }

        return { 
            success: false, 
            error: userFriendlyError,
            code: error.code
        };
    }
}

export async function sendOtpEmail(email: string, otp: string, type: 'registration' | 'password-reset' = 'registration') {
    const isRegistration = type === 'registration';
    const subject = isRegistration ? "Your Registration Verification Code" : "Your Password Reset Code";
    const title = isRegistration ? "HQ INVESTMENT Verification" : "HQ INVESTMENT Password Reset";
    const message = isRegistration 
        ? "Thank you for registering. Your 6-digit verification code is:" 
        : "We received a request to reset your password. Your 6-digit verification code is:";

    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #1a1a2e;">${title}</h2>
            <p>${message}</p>
            <div style="background-color: #f4f4f7; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0;">
                <h1 style="margin: 0; letter-spacing: 5px; font-size: 32px; color: #6366f1;">${otp}</h1>
            </div>
            <p style="font-size: 14px; color: #666;">This code will expire in 30 minutes.</p>
            <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
                If you did not request this code, please ignore this email.
            </p>
        </div>
    `;

    return sendEmail({
        to: email,
        subject,
        text: `${message} ${otp}. It will expire in 30 minutes.`,
        html,
    });
}
