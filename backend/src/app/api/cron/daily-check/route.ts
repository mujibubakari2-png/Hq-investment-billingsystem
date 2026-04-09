import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function GET(req: Request) {
    try {
        // Optional security - Require an authorization header if provided in ENV
        const authHeader = req.headers.get("authorization");
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const now = new Date();
        
        // Find tenants whose trial or license expires in EXACTLY 2 days (between 48 and 72 hours from now)
        // Or to be simpler: Just get all tenants that expire within 2 days and haven't been notified yet.
        // Wait, since we don't have a 'notified' flag in the schema, we can just find any account expiring 
        // between 1 and 3 days from now. But this will spam them daily for 2 days.
        // To be precise, we look for expiration dates between 48 hours and 72 hours from current execution.
        const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const twoDaysAndOneHourFromNow = new Date(now.getTime() + 2.1 * 24 * 60 * 60 * 1000); // Small window, assuming cron runs daily

        const expiringTenants = await prisma.tenant.findMany({
            where: {
                status: "ACTIVE",
                OR: [
                    {
                        licenseExpiresAt: {
                            gte: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Between 1 and 2 days
                            lte: twoDaysFromNow,
                        }
                    },
                    {
                        trialEnd: {
                            gte: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                            lte: twoDaysFromNow,
                        },
                        licenseExpiresAt: null 
                    }
                ]
            }
        });

        if (expiringTenants.length === 0) {
            return NextResponse.json({ message: "No tenants expiring in 2 days." });
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
                    subject: "Action Required: Your License Expires in 2 Days",
                    text: `Hello ${tenant.name},\n\nYour license is scheduled to expire on ${formattedDate}. Please log in to your dashboard and make a payment to renew your license before your account gets restricted.\n\nDashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173/'}`,
                    html: `<div style="font-family: sans-serif; padding: 20px;">
                            <h2>Subscription Expiration Warning</h2>
                            <p>Hello <strong>${tenant.name}</strong>,</p>
                            <p>This is a courtesy reminder that your license is expiring in <strong>2 days</strong> (on ${formattedDate}).</p>
                            <p>To avoid any service interruption and restriction of your account, please log in and generate an invoice payment.</p>
                            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173/'}renew" style="background-color: #d97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Renew Now</a>
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
