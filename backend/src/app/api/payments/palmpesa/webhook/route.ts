import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import { timingSafeEqual } from "@/lib/payments/utils";

export async function POST(req: NextRequest) {
    try {
        // Apply rate limiting
        const rateLimited = rateLimitMiddleware(req);
        if (rateLimited) {
            return rateLimited;
        }

        const webhookSecret = env.PALMPESA_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error("[PALMPESA WEBHOOK] Webhook secret is not configured");
            return errorResponse("Webhook secret is not configured", 500);
        }

        const providedSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-palmpesa-signature");
        if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
            return errorResponse("Unauthorized webhook signature", 401);
        }

        const body = await req.json();

        // Example payload from PalmPesa
        const {
            TransactionId, // e.g. "PXX123456"
            AccountReference, // This is the invoiceNumber
            Amount,
            ResultCode, // "0" for success
            ResultDesc
        } = body;
        if (!AccountReference) {
            return errorResponse("Missing payment reference", 400);
        }

        if (ResultCode !== "0") {
            console.log("PalmPesa payment failed:", ResultDesc);
            return jsonResponse({ message: "Acknowledged failure" });
        }

        // Find the invoice
        const globalDb = getTenantClient(null);
        const invoice = await globalDb.tenantInvoice.findUnique({
            where: { invoiceNumber: AccountReference },
            include: { tenant: true }
        });

        if (!invoice) {
            return errorResponse("Invoice not found", 404);
        }

        if (!invoice.tenantId) {
            return errorResponse("Invalid invoice tenant data", 500);
        }

        if (!invoice.tenant) {
            return errorResponse("Invoice tenant details are missing", 500);
        }

        if (invoice.status === "PAID") {
            return jsonResponse({ message: "Already paid" });
        }

        const tenantDb = getTenantClient(invoice.tenantId);

        // Run updates inside a tenant-scoped transaction.
        // Use conditional update to make webhook processing idempotent under retries.
        try {
            await tenantDb.$transaction(async (tx) => {
                const res = await tx.tenantInvoice.updateMany({
                    where: { id: invoice.id, status: { not: 'PAID' } },
                    data: { status: 'PAID' },
                });

                if (res.count === 0) {
                    throw new Error('ALREADY_PROCESSED');
                }

                // Create payment record
                await tx.tenantPayment.create({
                    data: {
                        invoiceId: invoice.id,
                        tenantId: invoice.tenantId,
                        amount: Number(Amount),
                        transactionId: TransactionId,
                        status: 'COMPLETED',
                        paymentMethod: 'PALMPESA',
                    },
                });

                // Activate the Tenant and Push Expiration Date Forward
                const now = new Date();
                let currentExpiry = invoice.tenant.licenseExpiresAt || invoice.tenant.trialEnd || now;
                if (currentExpiry < now) currentExpiry = now; // Prevent backdating

                const monthsToExtend = invoice.packageMonths || 0;
                const newExpiry = new Date(currentExpiry);
                newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend);

                await tx.tenant.update({
                    where: { id: invoice.tenantId },
                    data: { status: 'ACTIVE', licenseExpiresAt: newExpiry },
                });
            });
        } catch (err: any) {
            if (err?.message === 'ALREADY_PROCESSED') {
                return jsonResponse({ message: 'Already paid' });
            }
            throw err;
        }

        // Send activation email
        try {
            const appUrl = process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            await sendEmail({
                to: invoice.tenant.email,
                subject: "Payment Received & Account Activated",
                text: `Hello ${invoice.tenant.name},\n\nYour payment of ${Amount} has been received. Your account has been successfully renewed and activated!\n\nLog in here: ${appUrl}/`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Payment Received - Account Activated</h2>
                        <p>Hello <strong>${invoice.tenant.name}</strong>,</p>
                        <p>Your payment of <strong>${Amount}</strong> has been received.</p>
                        <p>Your account has been successfully renewed and activated!</p>
                        <a href="${appUrl}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
                    </div>
                `,
            });
            console.log("Activation email sent successfully to", invoice.tenant.email);
        } catch (mailError) {
            console.error("Failed to send activation email:", mailError);
        }

        return jsonResponse({ message: "Webhook processed successfully" });

    } catch (e) {
        console.error("PALMPESA WEBHOOK ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
