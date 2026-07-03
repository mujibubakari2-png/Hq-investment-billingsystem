/**
 * Centralized Email Service — HQ Investment ISP Billing System
 *
 * EMAIL-001: Replaced nodemailer/SMTP transport with Resend HTTP API.
 *
 * Why the change:
 *   Cloud VPS providers (DigitalOcean, AWS, etc.) block outbound SMTP ports 25/465/587
 *   by default. nodemailer connections were timing out or being refused at the network
 *   level, making OTP and notification emails completely non-functional in production.
 *   Resend uses HTTPS (port 443 — always open) and requires zero server-side SMTP config.
 *
 * Public API is unchanged — all callers (sendOtpEmail, accountNotifications, etc.)
 * continue to call sendEmail({ to, subject, text, html }) with no modifications needed.
 *
 * Setup (one-time):
 *   1. Create a free account at https://resend.com
 *   2. Verify your sending domain (or use the onboarding sandbox address for testing)
 *   3. Generate an API key: Resend Dashboard → API Keys → Create API Key
 *   4. Add to backend/.env:
 *        RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
 *        RESEND_FROM="HQ INVESTMENT <noreply@yourdomain.com>"
 *        # For testing before domain is verified use: onboarding@resend.dev
 *
 *   Free tier: 3 000 emails/month, 100/day — sufficient for most ISP deployments.
 */

import logger from "@/lib/logger";

const RESEND_API_URL = "https://api.resend.com/emails";

function getResendKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}

function getFromAddress(): string {
  return (
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||           // fall back to old env var so existing configs still work
    `"${process.env.APP_NAME || "HQ INVESTMENT"}" <onboarding@resend.dev>`
  );
}

// ─── Core send function ───────────────────────────────────────────────────────

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
}): Promise<{ success: boolean; messageId?: string; error?: string; code?: string }> {
  const apiKey = getResendKey();

  // EMAIL-002: Graceful degradation — if no API key is configured, log and skip.
  // This prevents hard crashes during local development when email is not set up.
  if (!apiKey) {
    logger.warn("[email] RESEND_API_KEY is not set — skipping email send", {
      subject,
      to,
      hint: "Add RESEND_API_KEY to your .env file to enable email.",
    });
    return {
      success: false,
      error: "Email service is not configured. Set RESEND_API_KEY in your .env file.",
      code: "EMAIL_NOT_CONFIGURED",
    };
  }

  const from = getFromAddress();
  logger.info("[email] Sending via Resend API", { to, subject });

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    });

    const data = await response.json().catch(() => ({})) as any;

    if (!response.ok) {
      const errMsg = data?.message || data?.name || `HTTP ${response.status}`;
      logger.error("[email] Resend API error", { status: response.status, error: errMsg, detail: data });
      return {
        success: false,
        error: errMsg,
        code: data?.name || `HTTP_${response.status}`,
      };
    }

    logger.info("[email] Sent successfully", { messageId: data?.id, to, subject });
    return { success: true, messageId: data?.id };

  } catch (err: any) {
    // Network-level failure (DNS, connection refused, timeout)
    logger.error("[email] Network error reaching Resend API", { error: err.message, code: err.code });
    return {
      success: false,
      error: `Network error: ${err.message}`,
      code: err.code || "NETWORK_ERROR",
    };
  }
}

// ─── OTP helper (unchanged public interface) ──────────────────────────────────

export async function sendOtpEmail(
  email: string,
  otp: string,
  type: "registration" | "password-reset" = "registration"
) {
  const isRegistration = type === "registration";
  const subject = isRegistration
    ? "Your Registration Verification Code"
    : "Your Password Reset Code";
  const title = isRegistration
    ? "HQ INVESTMENT Verification"
    : "HQ INVESTMENT Password Reset";
  const message = isRegistration
    ? "Thank you for registering. Your 6-digit verification code is:"
    : "We received a request to reset your password. Your 6-digit verification code is:";

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px;
                margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #1a1a2e;">${title}</h2>
      <p>${message}</p>
      <div style="background-color: #f4f4f7; padding: 20px; text-align: center;
                  border-radius: 5px; margin: 20px 0;">
        <h1 style="margin: 0; letter-spacing: 5px; font-size: 32px; color: #6366f1;">${otp}</h1>
      </div>
      <p style="font-size: 14px; color: #666;">This code will expire in 30 minutes.</p>
      <p style="font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee;
                padding-top: 10px;">
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
