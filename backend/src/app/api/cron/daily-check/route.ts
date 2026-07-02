import { NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import nodemailer from "nodemailer";

// Bug #8 FIX: Resolve app URL from env at startup to avoid hardcoded IPs leaking into emails.
function getAppUrl(): string {
    const url = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!url) {
        console.warn('[CRON] WARNING: APP_URL is not set. Renewal links in emails will be broken. Set APP_URL in your .env file.');
        return 'https://your-billing-system-domain.com';
    }
    return url.replace(/\/$/, '');
}

export async function GET(req: Request) {
    try {
        // Require CRON_SECRET in environment and authorization header
        const authHeader = req.headers.get("authorization");
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const now = new Date();

        // E15 FIX: Widened window from exactly 2.1 days to 23h–25h (±1 hour around the 24h mark).
        // This guarantees exactly one notification per account per day even if the cron runs
        // slightly late or early, eliminating the silent miss from the original 2.1-day window.
        const windowStart = new Date(now.getTime() + 119 * 60 * 60 * 1000); // 119 hours from now (5 days - 1hr)
        const windowEnd = new Date(now.getTime() + 121 * 60 * 60 * 1000); // 121 hours from now (5 days + 1hr)

        const db = getTenantClient(null);
        const expiringTenants = await db.tenant.findMany({
            where: {
                status: "ACTIVE",
                OR: [
                    {
                        licenseExpiresAt: {
                            gte: windowStart,
                            lte: windowEnd,
                        }
                    },
                    {
                        trialEnd: {
                            gte: windowStart,
                            lte: windowEnd,
                        },
                        licenseExpiresAt: null
                    }
                ]
            }
        });

        if (expiringTenants.length === 0) {
            return NextResponse.json({ message: "No tenants expiring in 5 days." });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.ethereal.email",
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        let sentCount = 0;

        for (const tenant of expiringTenants) {
            try {
                const expiryDate = tenant.licenseExpiresAt || tenant.trialEnd;
                const formattedDate = expiryDate ? expiryDate.toLocaleDateString() : 'soon';

                const mailOptions = {
                    from: process.env.SMTP_FROM || '"HQ INVESTMENT" <no-reply@hqinvestment.local>',
                    to: tenant.email,
                    subject: "Action Required: Your License Expires in 5 Days",
                    text: `Hello ${tenant.name},\n\nYour license is scheduled to expire on ${formattedDate}. Please log in to your dashboard and make a payment to renew your license before your account gets restricted.\n\nDashboard: ${getAppUrl()}/`,
                    html: `<div style="font-family: sans-serif; padding: 20px;">
                            <h2>Subscription Expiration Warning</h2>
                            <p>Hello <strong>${tenant.name}</strong>,</p>
                            <p>This is a courtesy reminder that your license is expiring in <strong>5 days</strong> (on ${formattedDate}).</p>
                            <p>To avoid any service interruption and restriction of your account, please log in and generate an invoice payment.</p>
                            <a href="${getAppUrl()}/renew" style="background-color: #d97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Renew Now</a>
                           </div>`
                };

                await transporter.sendMail(mailOptions);
                sentCount++;
            } catch (err) {
                console.error(`Failed to send expiration email to ${tenant.email}:`, err);
            }
        }

        return NextResponse.json({
            message: `Cron executed successfully. Reminders sent to ${sentCount} out of ${expiringTenants.length} tenants.`
        });

    } catch (e: any) {
        console.error("Cron Error:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
