import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import { timingSafeEqual } from "@/lib/payments/utils";

/**
 * POST /api/payments/zenopay/webhook
 *
 * Official ZenoPay webhook callback payload (docs: github.com/ZenoPay/zenopay-php):
 *   { order_id, payment_status, reference, metadata }
 *   payment_status: "COMPLETED" | "FAILED"
 *
 * Webhook verification: check x-api-key header against our API key (per official docs).
 *
 * MULTITENANT ARCHITECTURE:
 *   - Platform channel (tenantId=null): License/SaaS payments.
 *   - Tenant channel (tenantId=<value>): Hotspot/PPPoE customer payments via
 *     /api/webhooks/zenopay (central paymentService).
 *   This route handles PLATFORM (license) payments only.
 */
export async function POST(req: NextRequest) {
    try {
        const rateLimited = rateLimitMiddleware(req);
        if (rateLimited) return rateLimited;

        const globalDb = getTenantClient(null);
        let webhookSecret = env.ZENOPAY_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;
        let apiKey = env.ZENOPAY_API_KEY || "";

        const systemChannel = await globalDb.paymentChannel.findFirst({
            where: { provider: "ZENOPAY", status: "ACTIVE", tenantId: null },
        });

        if (systemChannel) {
            const { decrypt } = await import("@/lib/encryption");
            if (systemChannel.webhookSecret) {
                const dbSecret = decrypt(systemChannel.webhookSecret);
                if (dbSecret) webhookSecret = dbSecret;
            }
            if (systemChannel.apiKey) {
                const dbKey = decrypt(systemChannel.apiKey);
                if (dbKey) apiKey = dbKey;
            }
        }

        // Official docs: verify x-api-key header equals our API key
        const providedApiKey    = req.headers.get("x-api-key");
        const providedHmac      = req.headers.get("x-zeno-signature");
        const providedSecret    = req.headers.get("x-webhook-secret");

        const rawBody = await req.text();
        let body: any;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return errorResponse("Invalid JSON payload", 400);
        }

        let verified = false;

        if (providedApiKey && apiKey) {
            verified = timingSafeEqual(providedApiKey, apiKey);
        } else if (providedHmac && webhookSecret) {
            const { computeHmac } = await import("@/lib/payments/utils");
            const expected = computeHmac(webhookSecret, rawBody);
            verified = timingSafeEqual(providedHmac, expected);
        } else if (providedSecret && webhookSecret) {
            verified = timingSafeEqual(providedSecret, webhookSecret);
        }

        if (!verified) {
            return errorResponse("Unauthorized webhook signature", 401);
        }

        return handleZenopayPayload(body, globalDb);

    } catch (e) {
        console.error("ZENOPAY WEBHOOK ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

async function handleZenopayPayload(body: any, globalDb: any) {
    // Official payload: { order_id, payment_status, reference, metadata }
    const orderId       = (body?.order_id       as string) || "";
    const paymentStatus = ((body?.payment_status as string) || "").toUpperCase();

    if (!orderId) {
        return errorResponse("Missing order_id in webhook payload", 400);
    }

    const isSuccess = paymentStatus === "COMPLETED" || paymentStatus === "SUCCESS";
    if (!isSuccess) {
        console.log(`[ZENOPAY WEBHOOK] Non-success status for order ${orderId}: ${paymentStatus}`);
        return jsonResponse({ message: "Acknowledged non-success status" });
    }

    // Look up invoice: order_id = our invoiceNumber (sent as order_id during initiation)
    const invoice = await globalDb.tenantInvoice.findUnique({
        where: { invoiceNumber: orderId },
        include: { tenant: true },
    });

    if (!invoice) {
        console.error(`[ZENOPAY WEBHOOK] Invoice not found for order_id: ${orderId}`);
        return errorResponse("Invoice not found", 404);
    }

    // ISOLATION GUARD: Ensure this is a PLATFORM invoice (starts with INV-).
    // TENANT Hotspot/PPPoE payments use references like HP-... and should NOT trigger license activation.
    if (!invoice.invoiceNumber.startsWith("INV-")) {
        console.error(`[ZENOPAY WEBHOOK] Invoice ${invoice.invoiceNumber} is not a PLATFORM invoice. order_id: ${orderId}`);
        return errorResponse("Invoice not found (Cross-context mismatch)", 404);
    }

    if (!invoice.tenantId) return errorResponse("Invalid invoice tenant data", 500);
    if (!invoice.tenant)   return errorResponse("Invoice tenant details are missing", 500);

    if (invoice.status === "PAID") {
        return jsonResponse({ message: "Already paid" });
    }

    // ZenoPay does not send amount in webhook; we use invoice amount for activation
    const tenantDb = getTenantClient(invoice.tenantId);

    try {
        await tenantDb.$transaction(async (tx: any) => {
            const res = await tx.tenantInvoice.updateMany({
                where: { id: invoice.id, status: { not: "PAID" } },
                data:  { status: "PAID" },
            });

            if (res.count === 0) throw new Error("ALREADY_PROCESSED");

            await tx.tenantPayment.create({
                data: {
                    invoiceId:     invoice.id,
                    tenantId:      invoice.tenantId,
                    amount:        invoice.amount,
                    transactionId: orderId,
                    status:        "COMPLETED",
                    paymentMethod: "ZENOPAY",
                },
            });

            const now = new Date();
            let currentExpiry = invoice.tenant.licenseExpiresAt || invoice.tenant.trialEnd || now;
            if (currentExpiry < now) currentExpiry = now;

            const monthsToExtend = invoice.packageMonths || 0;
            const newExpiry = new Date(currentExpiry);
            newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend);

            await tx.tenant.update({
                where: { id: invoice.tenantId },
                data:  { status: "ACTIVE", licenseExpiresAt: newExpiry },
            });
        });
    } catch (err: any) {
        if (err?.message === "ALREADY_PROCESSED") return jsonResponse({ message: "Already paid" });
        throw err;
    }

    try {
        const appUrl = process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        await sendEmail({
            to:      invoice.tenant.email,
            subject: "Payment Received & Account Activated",
            text:    `Hello ${invoice.tenant.name},\n\nYour payment has been received. Your account has been successfully renewed!\n\nLog in here: ${appUrl}/`,
            html:    `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Payment Received - Account Activated</h2>
                    <p>Hello <strong>${invoice.tenant.name}</strong>,</p>
                    <p>Your payment has been received and your account has been renewed!</p>
                    <a href="${appUrl}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
                </div>
            `,
        });
    } catch (mailError) {
        console.error("[ZENOPAY WEBHOOK] Failed to send activation email:", mailError);
    }

    return jsonResponse({ message: "Webhook processed successfully" });
}
