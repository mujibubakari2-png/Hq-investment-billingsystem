import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import { timingSafeEqual } from "@/lib/payments/utils";
import logger from "@/lib/logger";

/**
 * POST /api/payments/palmpesa/webhook
 *
 * Handles webhook callbacks from PalmPesa Endpoint 02 (/api/palmpesa/initiate).
 *
 * Official callback payload (docs: https://documentation.palmpesa.co.tz/#webhook):
 *   { order_id: "PALMPESA17683440586334", payment_status: "COMPLETED" | "FAILED" | "PENDING" }
 *
 * NOTE: The `order_id` in the callback is PalmPesa's own reference (providerRef),
 * NOT our internal transaction reference. At initiation we receive the PalmPesa order_id
 * and store it as providerRef. On webhook we look up the transaction by providerRef.
 *
 * MULTITENANT ARCHITECTURE:
 *   - Platform channels (tenantId=null): handle License/SaaS invoice payments only.
 *   - Tenant channels (tenantId=<value>): handle Hotspot/PPPoE customer payments only.
 *   This webhook handles PLATFORM (license) payments only. Hotspot/PPPoE payments are
 *   routed through /api/webhooks/palmpesa which uses the central paymentService.
 */
export async function POST(req: NextRequest) {
    try {
        const rateLimited = await rateLimitMiddleware(req); // FIXED: was missing await
        if (rateLimited) return rateLimited;

        const globalDb = getTenantClient(null);
        let webhookSecret = env.PALMPESA_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;

        const systemChannel = await globalDb.paymentChannel.findFirst({
            where: { provider: "PALMPESA", status: "ACTIVE", tenantId: null },
        });

        if (systemChannel && systemChannel.webhookSecret) {
            const { decrypt } = await import("@/lib/encryption");
            const dbSecret = decrypt(systemChannel.webhookSecret);
            if (dbSecret) webhookSecret = dbSecret;
        }

        if (!webhookSecret) {
            logger.error("[PALMPESA WEBHOOK] Webhook secret is not configured");
            return errorResponse("Webhook secret is not configured", 500);
        }

        const providedSecret =
            req.headers.get("x-webhook-secret") ||
            req.headers.get("x-palmpesa-signature");

        if (!providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
            return errorResponse("Unauthorized webhook signature", 401);
        }

        const body = await req.json();

        // Official Endpoint 02 callback: { order_id, payment_status }
        const orderId        = (body?.order_id        as string) || "";
        const paymentStatus  = ((body?.payment_status as string) || "").toUpperCase();

        if (!orderId) {
            return errorResponse("Missing order_id in callback", 400);
        }

        // Non-success statuses: acknowledge and stop
        const isSuccess = paymentStatus === "COMPLETED" || paymentStatus === "SUCCESS";
        if (!isSuccess) {
            logger.info(`[PALMPESA WEBHOOK] Non-success status for order ${orderId}: ${paymentStatus}`);
            return jsonResponse({ message: "Acknowledged non-success status" });
        }

        // Look up the tenantInvoice by providerRef (= PalmPesa order_id stored at initiation)
        const invoice = await globalDb.tenantInvoice.findFirst({
            where: { providerRef: orderId } as any,
            include: { tenant: true },
        });

        // Fallback: some flows store our reference as the invoiceNumber
        const invoiceByNumber = !invoice
            ? await globalDb.tenantInvoice.findFirst({
                where: { invoiceNumber: orderId },
                include: { tenant: true },
            })
            : null;

        const resolvedInvoice = invoice ?? invoiceByNumber;

        if (!resolvedInvoice) {
            logger.error(`[PALMPESA WEBHOOK] Invoice not found for order_id: ${orderId}`);
            return errorResponse("Invoice not found", 404);
        }

        // ISOLATION GUARD: Ensure this is a PLATFORM invoice (starts with INV-).
        // TENANT Hotspot/PPPoE payments use references like HP-... and should NOT trigger license activation.
        if (!resolvedInvoice.invoiceNumber.startsWith("INV-")) {
            logger.error(`[PALMPESA WEBHOOK] Invoice ${resolvedInvoice.invoiceNumber} is not a PLATFORM invoice. order_id: ${orderId}`);
            return errorResponse("Invoice not found (Cross-context mismatch)", 404);
        }

        if (!resolvedInvoice.tenantId) {
            return errorResponse("Invalid invoice tenant data", 500);
        }

        if (!(resolvedInvoice as any).tenant) {
            return errorResponse("Invoice tenant details are missing", 500);
        }

        if (resolvedInvoice.status === "PAID") {
            return jsonResponse({ message: "Already paid" });
        }

        const tenantDb = getTenantClient(resolvedInvoice.tenantId);

        try {
            await tenantDb.$transaction(async (tx) => {
                const res = await tx.tenantInvoice.updateMany({
                    where: { id: resolvedInvoice.id, status: { not: "PAID" } },
                    data: { status: "PAID" },
                });

                if (res.count === 0) {
                    throw new Error("ALREADY_PROCESSED");
                }

                await tx.tenantPayment.create({
                    data: {
                        invoiceId:     resolvedInvoice.id,
                        tenantId:      resolvedInvoice.tenantId,
                        amount:        resolvedInvoice.amount,
                        transactionId: orderId,
                        status:        "COMPLETED",
                        paymentMethod: "PALMPESA",
                    },
                });

                const now = new Date();
                let currentExpiry =
                    (resolvedInvoice as any).tenant.licenseExpiresAt ||
                    (resolvedInvoice as any).tenant.trialEnd ||
                    now;
                if (currentExpiry < now) currentExpiry = now;

                const monthsToExtend = resolvedInvoice.packageMonths || 0;
                const newExpiry = new Date(currentExpiry);
                newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend);

                await tx.tenant.update({
                    where: { id: resolvedInvoice.tenantId },
                    data:  { status: "ACTIVE", licenseExpiresAt: newExpiry },
                });
            });
        } catch (err: any) {
            if (err?.message === "ALREADY_PROCESSED") {
                return jsonResponse({ message: "Already paid" });
            }
            throw err;
        }

        try {
            const appUrl = process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await sendEmail({
                to:      (resolvedInvoice as any).tenant.email,
                subject: "Payment Received & Account Activated",
                text:    `Hello ${(resolvedInvoice as any).tenant.name},\n\nYour payment has been received. Your account has been successfully renewed and activated!\n\nLog in here: ${appUrl}/`,
                html:    `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Payment Received - Account Activated</h2>
                        <p>Hello <strong>${(resolvedInvoice as any).tenant.name}</strong>,</p>
                        <p>Your payment has been received.</p>
                        <p>Your account has been successfully renewed and activated!</p>
                        <a href="${appUrl}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
                    </div>
                `,
            });
        } catch (mailError) {
            logger.error("[PALMPESA WEBHOOK] Failed to send activation email:", { error: mailError instanceof Error ? mailError.message : String(mailError) });
        }

        return jsonResponse({ message: "Webhook processed successfully" });

    } catch (e) {
        logger.error("PALMPESA WEBHOOK ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
