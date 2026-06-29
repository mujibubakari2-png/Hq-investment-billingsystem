/**
 * POST /api/payments/mongike/webhook
 *
 * Handles Mongike webhook callbacks for PLATFORM (license) payments.
 *
 * Official Mongike webhook payload (https://mongike.docs.buildwithfern.com/):
 *   { order_id, payment_status, reference, amount, metadata }
 *   order_id       = our reference sent at initiation (maps to invoiceNumber)
 *   payment_status = "COMPLETED"  (Mongike only fires webhook on COMPLETED)
 *   reference      = Mongike's gateway reference (providerRef)
 *   amount         = payment amount
 *
 * Webhook verification (official docs):
 *   "Mongike will send the x-api-key in the request header when calling your webhook URL."
 *   → Compare x-api-key header against our API key (timing-safe).
 *
 * MULTITENANT ARCHITECTURE:
 *   - Platform channel (tenantId=null): License/SaaS payments → THIS route.
 *   - Tenant channel (tenantId=<value>): Hotspot/PPPoE payments →
 *     /api/webhooks/mongike (central paymentService).
 */

import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimitMiddleware } from "@/middleware/rateLimiter";
import { timingSafeEqual } from "@/lib/payments/utils";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = rateLimitMiddleware(req);
    if (rateLimited) return rateLimited;

    const globalDb = getTenantClient(null);

    // Load platform channel credentials (tenantId=null)
    let apiKey = env.MONGIKE_API_KEY || "";

    const systemChannel = await globalDb.paymentChannel.findFirst({
      where: { provider: "MONGIKE", status: "ACTIVE", tenantId: null },
    });

    if (systemChannel?.apiKey) {
      const { decrypt } = await import("@/lib/encryption");
      const dbKey = decrypt(systemChannel.apiKey);
      if (dbKey) apiKey = dbKey;
    }

    if (!apiKey) {
      console.error("[MONGIKE WEBHOOK] API key not configured — cannot verify webhook.");
      return errorResponse("API key not configured", 500);
    }

    // Official verification: Mongike sends x-api-key header equal to our API key
    const incomingApiKey = req.headers.get("x-api-key") ?? "";
    if (!incomingApiKey || !timingSafeEqual(incomingApiKey, apiKey)) {
      console.warn("[MONGIKE WEBHOOK] x-api-key mismatch — rejecting webhook.");
      return errorResponse("Unauthorized webhook signature", 401);
    }

    const rawBody = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    // Official payload fields:
    //   order_id       → our reference (invoiceNumber)
    //   payment_status → "COMPLETED"
    //   reference      → Mongike gateway ref (providerRef)
    //   amount         → payment amount
    const orderId = (body?.order_id as string) ?? "";
    const rawStatus = ((body?.payment_status as string) ?? "").toUpperCase();
    const mongRef = (body?.reference as string) ?? "";
    const amount = body?.amount != null ? Number(body.amount) : null;

    if (!orderId) {
      return errorResponse("Missing order_id in webhook payload", 400);
    }

    // Mongike only fires webhook on COMPLETED per docs, but guard defensively
    const isSuccess = rawStatus === "COMPLETED" || rawStatus === "SUCCESS";
    if (!isSuccess) {
      console.log(`[MONGIKE WEBHOOK] Non-success status for order ${orderId}: ${rawStatus}`);
      return jsonResponse({ message: "Acknowledged non-success status" });
    }

    // Look up the license invoice by invoiceNumber (= order_id we sent at initiation)
    const invoice = await globalDb.tenantInvoice.findFirst({
      where: { invoiceNumber: orderId },
      include: { tenant: true },
    });

    // Fallback: try by providerRef (Mongike gateway reference)
    const resolvedInvoice = invoice ?? (mongRef
      ? await globalDb.tenantInvoice.findFirst({
          where: { providerRef: mongRef } as any,
          include: { tenant: true },
        })
      : null);

    if (!resolvedInvoice) {
      console.error(`[MONGIKE WEBHOOK] Invoice not found for order_id: ${orderId}`);
      return errorResponse("Invoice not found", 404);
    }

    // ISOLATION GUARD: Ensure this is a PLATFORM invoice (starts with INV-).
    // TENANT Hotspot/PPPoE payments use references like HP-... and should NOT trigger license activation.
    if (!resolvedInvoice.invoiceNumber.startsWith("INV-")) {
      console.error(`[MONGIKE WEBHOOK] Invoice ${resolvedInvoice.invoiceNumber} is not a PLATFORM invoice. order_id: ${orderId}`);
      return errorResponse("Invoice not found (Cross-context mismatch)", 404);
    }

    if (!resolvedInvoice.tenantId) return errorResponse("Invalid invoice tenant data", 500);
    if (!(resolvedInvoice as any).tenant)   return errorResponse("Invoice tenant details are missing", 500);

    if (resolvedInvoice.status === "PAID") {
      return jsonResponse({ message: "Already paid" });
    }

    const tenantDb = getTenantClient(resolvedInvoice.tenantId);

    try {
      await tenantDb.$transaction(async (tx: any) => {
        // Amount verification — only if Mongike included amount
        if (amount !== null && amount < resolvedInvoice.amount) {
          await tx.tenantPayment.create({
            data: {
              invoiceId:     resolvedInvoice.id,
              tenantId:      resolvedInvoice.tenantId,
              amount,
              transactionId: mongRef || null,
              status:        "FAILED",
              paymentMethod: "MONGIKE",
            },
          });
          throw new Error("PARTIAL_PAYMENT");
        }

        const res = await tx.tenantInvoice.updateMany({
          where: { id: resolvedInvoice.id, status: { not: "PAID" } },
          data:  { status: "PAID" },
        });

        if (res.count === 0) throw new Error("ALREADY_PROCESSED");

        await tx.tenantPayment.create({
          data: {
            invoiceId:     resolvedInvoice.id,
            tenantId:      resolvedInvoice.tenantId,
            amount:        amount ?? resolvedInvoice.amount,
            transactionId: mongRef || null,
            status:        "COMPLETED",
            paymentMethod: "MONGIKE",
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
      if (err?.message === "PARTIAL_PAYMENT")  return errorResponse("Payment amount is less than invoice amount", 400);
      if (err?.message === "ALREADY_PROCESSED") return jsonResponse({ message: "Already paid" });
      throw err;
    }

    // Send activation email
    try {
      const appUrl = process.env.APP_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await sendEmail({
        to:      (resolvedInvoice as any).tenant.email,
        subject: "Payment Received & Account Activated",
        text:    `Hello ${(resolvedInvoice as any).tenant.name},\n\nYour payment has been received. Your account has been successfully renewed and activated!\n\nLog in here: ${appUrl}/`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Payment Received - Account Activated</h2>
            <p>Hello <strong>${(resolvedInvoice as any).tenant.name}</strong>,</p>
            <p>Your payment has been received and your account has been successfully renewed and activated!</p>
            <a href="${appUrl}" style="background-color: #1d4ed8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Log In to Dashboard</a>
          </div>
        `,
      });
    } catch (mailError) {
      console.error("[MONGIKE WEBHOOK] Failed to send activation email:", mailError);
    }

    return jsonResponse({ message: "Webhook processed successfully" });

  } catch (e) {
    console.error("[MONGIKE WEBHOOK] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
