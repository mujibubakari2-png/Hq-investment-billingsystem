import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * POST /api/contact
 *
 * E06 FIX: This endpoint was missing — the landing page contact form was
 * fetching /api/contact which returned 404. Accepts name, email, message
 * and forwards to the configured SMTP address.
 *
 * Body: { name: string, email: string, message: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const name    = String(body.name    || "").trim();
        const email   = String(body.email   || "").trim();
        const message = String(body.message || "").trim();

        // ── Validation ────────────────────────────────────────────────────────
        if (!name)    return errorResponse("Name is required", 400);
        if (!email)   return errorResponse("Email is required", 400);
        if (!message) return errorResponse("Message is required", 400);

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse("Invalid email address", 400);
        }

        // Length guards to prevent abuse
        if (name.length > 100)    return errorResponse("Name too long (max 100 chars)", 400);
        if (message.length > 5000) return errorResponse("Message too long (max 5000 chars)", 400);

        // ── Send notification email to admin ──────────────────────────────────
        const recipientEmail =
            env.SMTP_FROM?.match(/<(.+?)>/)?.[1] ||
            env.SMTP_USER ||
            "support@hqinvestment.local";

        const appName = env.APP_NAME || "HQ INVESTMENT";

        const result = await sendEmail({
            to: recipientEmail,
            subject: `[${appName}] New Contact Form Submission from ${name}`,
            text: [
                `New contact form submission:`,
                ``,
                `Name:    ${name}`,
                `Email:   ${email}`,
                `Message: ${message}`,
                ``,
                `Sent at: ${new Date().toISOString()}`,
            ].join("\n"),
            html: `
                <div style="font-family: sans-serif; padding: 24px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #1a1a2e; margin-top: 0;">📩 New Contact Form Submission</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 0.875rem; width: 80px;"><strong>Name</strong></td>
                            <td style="padding: 8px 0;">${name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; font-size: 0.875rem;"><strong>Email</strong></td>
                            <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #6366f1;">${email}</a></td>
                        </tr>
                    </table>
                    <div style="background: #f9fafb; border-left: 4px solid #6366f1; padding: 16px; border-radius: 4px;">
                        <p style="margin: 0; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                    </div>
                    <p style="font-size: 0.75rem; color: #9ca3af; margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
                        Received at ${new Date().toUTCString()} via ${appName} contact form
                    </p>
                </div>
            `,
        });

        if (!result.success) {
            console.error("[CONTACT] Failed to send contact email:", result.error);
            // Still return success to the user — don't expose internal SMTP errors
            // Log it and handle via monitoring
        }

        // ── Send acknowledgement to the sender ────────────────────────────────
        await sendEmail({
            to: email,
            subject: `We received your message — ${appName}`,
            text: `Hi ${name},\n\nThank you for reaching out. We have received your message and will get back to you as soon as possible.\n\nBest regards,\n${appName} Team`,
            html: `
                <div style="font-family: sans-serif; padding: 24px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #1a1a2e; margin-top: 0;">Thank you, ${name}!</h2>
                    <p style="line-height: 1.6;">We have received your message and will get back to you as soon as possible.</p>
                    <p style="line-height: 1.6;">If your enquiry is urgent, please contact us directly via the information on our website.</p>
                    <p style="margin-top: 24px; font-size: 0.875rem; color: #6b7280;">
                        — ${appName} Team
                    </p>
                </div>
            `,
        }).catch((e) => {
            // Acknowledgement failure is non-critical — just log it
            console.warn("[CONTACT] Acknowledgement email failed:", e);
        });

        return jsonResponse({ success: true, message: "Your message has been received. We will be in touch shortly." });

    } catch (e) {
        console.error("[CONTACT] Error:", e);
        return errorResponse("Failed to send message. Please try again later.", 500);
    }
}

/**
 * GET /api/contact — health check / CORS preflight support
 */
export async function GET() {
    return jsonResponse({ status: "ok", endpoint: "/api/contact" });
}
