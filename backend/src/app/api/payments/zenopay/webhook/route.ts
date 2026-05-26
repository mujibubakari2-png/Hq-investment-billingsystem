import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";

export async function POST(req: NextRequest) {
    try {
        // Apply rate limiting
        const rateLimited = rateLimitMiddleware(req);
        if (rateLimited) {
            return rateLimited;
        }

        const webhookSecret = env.ZENOPAY_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;
        if (webhookSecret) {
            const providedSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-zeno-signature");
            if (providedSecret !== webhookSecret) {
                return errorResponse("Unauthorized webhook signature", 401);
            }
        }

        const body = await req.json();
        
        // ZenoPay payload extraction
        const orderId = (body?.order_id as string) || (body?.reference as string) || "";
        const transactionId = (body?.transaction_id as string) || (body?.provider_ref as string) || "";
        const rawStatus = ((body?.status as string) || (body?.payment_status as string) || "").toUpperCase();
        const amount = body?.amount ? Number(body.amount) : null;

        if (!orderId) {
            return errorResponse("Missing payment reference (orderId)", 400);
        }

        const isSuccess = rawStatus === "COMPLETED" || rawStatus === "SUCCESS" || rawStatus === "PAID";
        if (!isSuccess) {
            console.log(`[ZENOPAY WEBHOOK] Payment failed or pending for order ${orderId}: ${rawStatus}`);
            return jsonResponse({ message: "Acknowledged non-success status" });
        }

        // Find the invoice
        const invoice = await prisma.tenantInvoice.findUnique({
            where: { invoiceNumber: orderId },
            include: { tenant: true }
        });

        if (!invoice) {
            return errorResponse("Invoice not found", 404);
        }

        if (invoice.status === "PAID") {
            return jsonResponse({ message: "Already paid" });
        }

        // Run updates inside a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Update invoice status
            await tx.tenantInvoice.update({
                where: { id: invoice.id },
                data: { status: "PAID" }
            });

            // 2. Create payment record
            await tx.tenantPayment.create({
                data: {
                    invoiceId: invoice.id,
                    tenantId: invoice.tenantId,
                    amount: amount || invoice.amount,
                    transactionId: transactionId || null,
                    status: "COMPLETED",
                    paymentMethod: "ZENOPAY" 
                }
            });

            // 3. Activate the Tenant and Push Expiration Date Forward
            const now = new Date();
            let currentExpiry = invoice.tenant.licenseExpiresAt || invoice.tenant.trialEnd || now;
            if (currentExpiry < now) currentExpiry = now; // Prevent backdating

            const monthsToExtend = invoice.packageMonths || 0;
            const newExpiry = new Date(currentExpiry);
            newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend);

            await tx.tenant.update({
                where: { id: invoice.tenantId },
                data: { 
                    status: "ACTIVE",
                    licenseExpiresAt: newExpiry
                }
            });
        });

        // Send activation email
        try {
            if (env.SMTP_USER && env.SMTP_PASS) {
                const transporter = nodemailer.createTransport({
                    host: env.SMTP_HOST,
                    port: Number(env.SMTP_PORT) || 587,
                    secure: env.SMTP_SECURE === "true",
                    auth: {
                        user: env.SMTP_USER,
                        pass: env.SMTP_PASS,
                    },
                });

                const mailOptions = {
                    from: env.SMTP_FROM || '"HQ INVESTMENT Billing" <billing@hqinvestment.co.tz>',
                    to: invoice.tenant.email,
                    subject: "Payment Received & Account Activated",
                    text: `Hello ${invoice.tenant.name},\n\nYour payment has been received. Your account has been successfully renewed and activated!\n\nLog in here: ${process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://174.138.42.168'}/`,
                    html: `<div style="font-family: sans-serif; padding: 20px;">
                            <h2>Account Activated!</h2>
                            <p>Hello <strong>${invoice.tenant.name}</strong>,</p>
                            <p>We have successfully received your payment of <strong>${(amount || invoice.amount).toLocaleString()}/= TZS</strong> via ZenoPay.</p>
                            <p>Your subscription has been renewed and your account is now <strong>ACTIVE</strong>.</p>
                            <a href="${process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://174.138.42.168'}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
                           </div>`
                };

                await transporter.sendMail(mailOptions);
                console.log("Activation email sent successfully to", invoice.tenant.email);
            }
        } catch (mailError) {
            console.error("Failed to send activation email:", mailError);
        }

        return jsonResponse({ message: "Webhook processed successfully" });

    } catch (e) {
        console.error("ZENOPAY WEBHOOK ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
