/**
 * POST /api/payments/harakapay/webhook
 *
 * Handles HarakaPay webhook callbacks for PLATFORM (license) payments.
 *
 * Official HarakaPay webhook payload (https://harakapay.net/api/docs):
 *   { order_id, status, amount, net_amount, fee_amount, created_at, completed_at }
 *   order_id = our reference sent at initiation (maps to invoiceNumber)
 *   status   = "completed" | "failed"
 *   amount   = payment amount in TZS
 *
 * Webhook verification:
 *   HarakaPay docs do not document a signature scheme.
 *   We verify using a shared webhook secret in x-webhook-secret header,
 *   or HMAC in x-haraka-signature header if configured.
 *
 * MULTITENANT ARCHITECTURE:
 *   - Platform channel (tenantId=null): License/SaaS payments → THIS route.
 *   - Tenant channel (tenantId=<value>): Hotspot/PPPoE payments →
 *     /api/webhooks/harakapay (central paymentService).
 */

import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import { computeHmac, timingSafeEqual } from "@/lib/payments/utils";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = rateLimitMiddleware(req);
    if (rateLimited) return rateLimited;

    const globalDb = getTenantClient(null);
    let webhookSecret = env.HARAKAPAY_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;

    const systemChannel = await globalDb.paymentChannel.findFirst({
      where: { provider: "HARAKAPAY", status: "ACTIVE", tenantId: null },
    });

    if (systemChannel?.webhookSecret) {
      const { decrypt } = await import("@/lib/encryption");
      const dbSecret = decrypt(systemChannel.webhookSecret);
      if (dbSecret) webhookSecret = dbSecret;
    }

    const rawBody = await req.text();

    // Verify webhook — HarakaPay does not document a standard signature.
    // Support HMAC in x-haraka-signature and shared secret in x-webhook-secret.
    if (webhookSecret) {
      const hmacHeader =
        req.headers.get("x-haraka-signature") ??
        req.headers.get("x-webhook-signature");

      const secretHeader =
        req.headers.get("x-webhook-secret") ??
        req.headers.get("x-haraka-secret");

      if (hmacHeader) {
        const expected = computeHmac(webhookSecret, rawBody);
        if (!timingSafeEqual(hmacHeader, expected)) {
          return errorResponse("Unauthorized webhook signature", 401);
        }
      } else if (secretHeader) {
        if (!timingSafeEqual(secretHeader, webhookSecret)) {
          return errorResponse("Unauthorized webhook signature", 401);
        }
      }
      // If no signature header present, proceed (HarakaPay may not send one)
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    // Official HarakaPay webhook fields: order_id, status, amount
    const orderId = (body?.order_id as string) ?? "";
    // status is lowercase per docs: "completed" | "failed"
    const rawStatus = ((body?.status as string) ?? "").toLowerCase();
    const amount = body?.amount != null ? Number(body.amount) : null;

    if (!orderId) {
      return errorResponse("Missing order_id in webhook payload", 400);
    }

    const isSuccess = rawStatus === "completed";
    if (!isSuccess) {
      console.log(`[HARAKAPAY WEBHOOK] Non-success status for order ${orderId}: ${rawStatus}`);
      return jsonResponse({ message: "Acknowledged non-success status" });
    }

    // Look up the license invoice by invoiceNumber (= order_id we sent at initiation)
    const invoice = await globalDb.tenantInvoice.findFirst({
      where: { invoiceNumber: orderId },
      include: { tenant: true },
    });

    if (!invoice) {
      console.error(`[HARAKAPAY WEBHOOK] Invoice not found for order_id: ${orderId}`);
      return errorResponse("Invoice not found", 404);
    }

    // ISOLATION GUARD: Ensure this is a PLATFORM invoice (starts with INV-).
    // TENANT Hotspot/PPPoE payments use references like HP-... and should NOT trigger license activation.
    if (!invoice.invoiceNumber.startsWith("INV-")) {
      console.error(`[HARAKAPAY WEBHOOK] Invoice ${invoice.invoiceNumber} is not a PLATFORM invoice. order_id: ${orderId}`);
      return errorResponse("Invoice not found (Cross-context mismatch)", 404);
    }

    if (!invoice.tenantId) return errorResponse("Invalid invoice tenant data", 500);
    if (!invoice.tenant)   return errorResponse("Invoice tenant details are missing", 500);

    if (invoice.status === "PAID") {
      return jsonResponse({ message: "Already paid" });
    }

    const tenantDb = getTenantClient(invoice.tenantId);

    try {
      await tenantDb.$transaction(async (tx: any) => {
        // Amount verification — only if HarakaPay included amount
        if (amount !== null && amount < invoice.amount) {
          await tx.tenantPayment.create({
            data: {
              invoiceId:     invoice.id,
              tenantId:      invoice.tenantId,
              amount,
              transactionId: orderId,
              status:        "FAILED",
              paymentMethod: "HARAKAPAY",
            },
          });
          throw new Error("PARTIAL_PAYMENT");
        }

        const res = await tx.tenantInvoice.updateMany({
          where: { id: invoice.id, status: { not: "PAID" } },
          data:  { status: "PAID" },
        });

        if (res.count === 0) throw new Error("ALREADY_PROCESSED");

        await tx.tenantPayment.create({
          data: {
            invoiceId:     invoice.id,
            tenantId:      invoice.tenantId,
            amount:        amount ?? invoice.amount,
            transactionId: orderId,
            status:        "COMPLETED",
            paymentMethod: "HARAKAPAY",
          },
        });

        const now = new Date();
        let currentExpiry =
          invoice.tenant.licenseExpiresAt ||
          invoice.tenant.trialEnd ||
          now;
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
      if (err?.message === "PARTIAL_PAYMENT")   return errorResponse("Payment amount is less than invoice amount", 400);
      if (err?.message === "ALREADY_PROCESSED") return jsonResponse({ message: "Already paid" });
      throw err;
    }

    // Send activation email
    try {
      const appUrl = process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await sendEmail({
        to:      invoice.tenant.email,
        subject: "Payment Received & Account Activated",
        text:    `Hello ${invoice.tenant.name},\n\nYour payment has been received. Your account has been successfully renewed and activated!\n\nLog in here: ${appUrl}/`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Payment Received - Account Activated</h2>
            <p>Hello <strong>${invoice.tenant.name}</strong>,</p>
            <p>Your payment has been received and your account has been successfully renewed and activated!</p>
            <a href="${appUrl}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("[HARAKAPAY WEBHOOK] Failed to send activation email:", mailError);
    }

    return jsonResponse({ message: "Webhook processed successfully" });

  } catch (e) {
    console.error("[HARAKAPAY WEBHOOK] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
