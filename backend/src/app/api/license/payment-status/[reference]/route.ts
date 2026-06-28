/**
 * GET /api/license/payment-status/[reference]
 *
 * Poll the status of a LICENSE renewal STK Push payment.
 *
 * Uses tenantPayment records (created by /api/license/renew) — NOT the
 * hotspot/PPPoE `transaction` table used by /api/payments/status.
 *
 * Query params:
 *   provider    — optional; if present, live-polls the payment gateway
 *   providerRef — optional; provider's own order/checkout ID for live poll
 *
 * Response states returned to frontend:
 *   PENDING     — STK push sent, awaiting confirmation
 *   PROCESSING  — provider confirmed but webhook not yet processed
 *   PAID        — payment confirmed (webhook updated record to COMPLETED)
 *   FAILED      — payment failed at provider
 *   CANCELLED   — user cancelled on phone
 *   EXPIRED     — payment request timed out at provider
 *
 * Auth: requires a valid JWT (same tenant as the invoice).
 */

import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getJwtTenantId, isPlatformSuperAdmin } from "@/lib/tenant";
import { paymentService } from "@/lib/payments/service";
import { isSupportedProvider } from "@/lib/payments/registry";

/** Map DB status → frontend poll state */
const STATUS_MAP: Record<string, string> = {
  PENDING:   "PENDING",
  COMPLETED: "PAID",
  PAID:      "PAID",
  FAILED:    "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED:   "EXPIRED",
};

const TERMINAL_MESSAGES: Record<string, string> = {
  PAID:      "Payment confirmed! Your license has been renewed.",
  FAILED:    "Payment failed. Please try again or contact support.",
  CANCELLED: "Payment cancelled.",
  EXPIRED:   "Payment request expired. Please try again.",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const guard = requirePermission(req, "license:renew");
    if (guard.error) return guard.error;
    const userPayload = guard.user;

    const { reference } = await params;
    if (!reference) return errorResponse("reference is required", 400);

    const tenantId = isPlatformSuperAdmin(userPayload)
      ? null
      : getJwtTenantId(userPayload);

    const { searchParams } = new URL(req.url);
    const providerParam  = searchParams.get("provider")?.toUpperCase();
    const providerRef    = searchParams.get("providerRef");
    const paymentIdParam = searchParams.get("paymentId");

    const globalDb = getTenantClient(null);

    // ── Strategy 1: look up via paymentId (most reliable) ───────────────────
    let payment: any = null;
    let invoice: any = null;

    if (paymentIdParam) {
      payment = await globalDb.tenantPayment.findFirst({
        where: { id: paymentIdParam },
      });
      if (payment) {
        invoice = await globalDb.tenantInvoice.findFirst({
          where: { id: payment.invoiceId },
        });
      }
    }

    // ── Strategy 2: look up via invoiceNumber (the reference string) ─────────
    if (!payment) {
      invoice = await globalDb.tenantInvoice.findFirst({
        where: {
          invoiceNumber: reference,
          ...(tenantId ? { tenantId } : {}),
        },
        include: {
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      payment = (invoice as any)?.payments?.[0] ?? null;
    }

    if (!invoice && !payment) {
      return errorResponse("Payment record not found", 404);
    }

    let dbStatus   = payment?.status ?? "PENDING";
    let mappedStatus = STATUS_MAP[dbStatus] ?? dbStatus;

    // ── Live provider poll (only while PENDING) ──────────────────────────────
    const effectiveProviderRef = providerRef ?? payment?.transactionId ?? null;

    if (
      mappedStatus === "PENDING" &&
      providerParam &&
      effectiveProviderRef &&
      isSupportedProvider(providerParam)
    ) {
      try {
        const liveStatus = await paymentService.checkStatus(
          providerParam,
          effectiveProviderRef,
          null  // platform channel (LICENSE context)
        );

        const raw = String(liveStatus.status ?? "").toUpperCase();

        if (raw === "COMPLETED" || raw === "PAID") {
          // Webhook may not have landed yet; PROCESSING is a bridge state.
          // Frontend keeps polling; DB will flip to COMPLETED once webhook fires.
          mappedStatus = "PROCESSING";
        } else if (raw === "FAILED") {
          mappedStatus = "FAILED";
        } else if (raw === "CANCELLED") {
          mappedStatus = "CANCELLED";
        } else if (raw === "EXPIRED") {
          mappedStatus = "EXPIRED";
        }
        // else: still PENDING — do nothing
      } catch (pollErr) {
        console.warn("[LICENSE/PAYMENT-STATUS] Live provider poll failed:", pollErr);
      }
    }

    const message =
      TERMINAL_MESSAGES[mappedStatus] ??
      (mappedStatus === "PROCESSING"
        ? "Provider confirmed — finalizing your license..."
        : "Waiting for payment confirmation...");

    return jsonResponse({
      reference,
      status: mappedStatus,
      message,
      invoiceId:     invoice?.id   ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? reference,
      amount:        invoice?.amount ?? payment?.amount ?? null,
      providerRef:   effectiveProviderRef,
      paymentId:     payment?.id ?? null,
    });

  } catch (e) {
    console.error("[LICENSE/PAYMENT-STATUS] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
