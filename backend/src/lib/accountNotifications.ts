import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

type AccountNotificationInput = {
    tenantId?: string | null;
    tenantName: string;
    email?: string | null;
    phone?: string | null;
};

function isNotificationsEnabled(): boolean {
    const val = process.env.ACCOUNT_NOTIFICATIONS_ENABLED;
    return val === undefined ? true : val === "true";
}

function isSmsNotificationsEnabled(): boolean {
    return process.env.ACCOUNT_SMS_NOTIFICATIONS_ENABLED === "true";
}

function getPortalUrl(): string {
    return (
        process.env.ACCOUNT_PORTAL_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "http://localhost:5173/"
    );
}

async function createSmsLog(recipient: string, message: string, tenantId?: string | null) {
    try {
        await prisma.smsMessage.create({
            data: {
                recipient,
                message,
                type: "INDIVIDUAL",
                status: "SENT",
                tenantId: tenantId || null,
            },
        });
    } catch (err) {
        console.error("[ACCOUNT NOTIFICATIONS] Failed to create SMS log:", err);
    }
}

export async function sendAccountCreatedNotifications(input: AccountNotificationInput) {
    if (!isNotificationsEnabled()) return;

    const portalUrl = getPortalUrl();
    const tenantName = input.tenantName || "Customer";

    if (input.email) {
        await sendEmail({
            to: input.email,
            subject: "Account Received - Pending Approval",
            text:
                `Hello ${tenantName},\n\n` +
                "Your account was created successfully and is now pending admin approval.\n" +
                "You will receive another message once your account is approved.\n\n" +
                `Portal: ${portalUrl}`,
            html:
                `<div style="font-family: sans-serif; padding: 20px;">` +
                `<h2>Account Received</h2>` +
                `<p>Hello <strong>${tenantName}</strong>,</p>` +
                `<p>Your account was created successfully and is now <strong>pending approval</strong>.</p>` +
                `<p>You will receive another message once your account is approved.</p>` +
                `<a href="${portalUrl}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:10px;">Open Portal</a>` +
                `</div>`,
        });
    }

    if (input.phone && isSmsNotificationsEnabled()) {
        const smsText = `Hello ${tenantName}, your account request was received and is pending admin approval.`;
        await createSmsLog(input.phone, smsText, input.tenantId);
    }
}

export async function sendAccountApprovedNotifications(input: AccountNotificationInput) {
    if (!isNotificationsEnabled()) return;

    const portalUrl = getPortalUrl();
    const tenantName = input.tenantName || "Customer";

    if (input.email) {
        await sendEmail({
            to: input.email,
            subject: "Account Approved - Welcome",
            text:
                `Hello ${tenantName},\n\n` +
                "Your account has been approved successfully.\n" +
                "You can now login and start using the system.\n\n" +
                `Login: ${portalUrl}`,
            html:
                `<div style="font-family: sans-serif; padding: 20px;">` +
                `<h2>Account Approved</h2>` +
                `<p>Hello <strong>${tenantName}</strong>,</p>` +
                `<p>Your account has been approved successfully.</p>` +
                `<p>You can now login and start using the system.</p>` +
                `<a href="${portalUrl}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:10px;">Login to Dashboard</a>` +
                `</div>`,
        });
    }

    if (input.phone && isSmsNotificationsEnabled()) {
        const smsText = `Hello ${tenantName}, your account is approved. You can now login to your dashboard.`;
        await createSmsLog(input.phone, smsText, input.tenantId);
    }
}
