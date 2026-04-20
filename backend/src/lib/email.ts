import nodemailer from "nodemailer";

/**
 * Centralized email service for HQ Investment ISP Billing System.
 * Handles OTP and system notifications using SMTP.
 */

const smtpConfig: any = {
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
    },
    // Force IPv4 (resolves ENETUNREACH errors with IPv6 in some environments)
    family: 4
};

console.log(`[EMAIL] SMTP Configuration: Host=${smtpConfig.host}, Port=${smtpConfig.port}, Secure=${smtpConfig.secure}, User=${smtpConfig.auth.user ? "Set" : "Not Set"}`);

const transporter = nodemailer.createTransport(smtpConfig);

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
    const from = process.env.SMTP_FROM || '"HQ INVESTMENT" <no-reply@hqinvestment.co.tz>';

    console.log(`[EMAIL] Attempting to send email to ${to} (Host: ${smtpConfig.host})`);

    try {
        // Test connection before sending if we are using custom SMTP
        if (process.env.SMTP_HOST && process.env.SMTP_HOST !== "smtp.ethereal.email") {
            console.log(`[EMAIL] Verifying connection to ${smtpConfig.host}...`);
            await transporter.verify();
        }

        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html,
        });

        console.log(`[EMAIL] Email sent successfully: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error: any) {
        console.error("[EMAIL] Failed to send email:", error.message);
        console.error("[EMAIL] Error Code:", error.code);
        console.error("[EMAIL] Full Error:", JSON.stringify(error));
        
        let userFriendlyError = error.message;
        if (error.code === 'EAUTH') {
            userFriendlyError = "Authentication failed. Please verify your SMTP_USER and SMTP_PASS (App Password).";
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            userFriendlyError = `Could not connect to ${smtpConfig.host}:${smtpConfig.port}. Check your firewall or port settings.`;
        } else if (error.code === 'ENETUNREACH') {
            userFriendlyError = `Network unreachable. Try changing SMTP_PORT to 465 and setting SMTP_SECURE to true.`;
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
