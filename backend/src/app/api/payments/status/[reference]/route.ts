/**
 * GET /api/payments/status/[reference]
 *
 * Check the current status of a hotspot/PPPoE payment transaction by our
 * internal reference. Also optionally polls the provider for live status.
 *
 * ISOLATION CONTRACT:
 *   - The hotspot portal does not require a JWT (unauthenticated public endpoint).
 *   - Callers who know a reference can only see the specific fields returned:
 *     status, amount, packageName, username (on COMPLETED only).
 *   - The reference itself is a 16-char hex random string (HP-/PP-prefix) generated
 *     via crypto.randomUUID(), making it effectively unguessable.
 *   - The response NEVER includes tenantId, clientId, phone, or full client data.
 *   - Live provider poll is scoped to the transaction's own tenantId — it NEVER
 *     uses the platform (LICENSE) channel credentials for a TENANT transaction.
 *
 * Query params:
 *   - provider (optional) — if provided, polls the live provider API
 *   - providerRef (optional) — provider's own transaction ID for live check
 */

import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getTenantClient } from "@/lib/tenantPrisma";
import { paymentService } from "@/lib/payments/service";
import { isSupportedProvider } from "@/lib/payments/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    if (!reference) return errorResponse("reference is required", 400);

    // Sanity-check: references are always HP-/PP- prefixed hex strings.
    // Reject anything that looks like an invoice number (INV-) to prevent
    // license invoice data from leaking through this public endpoint.
    if (/^INV-/i.test(reference)) {
      return errorResponse("Transaction not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const providerParam = searchParams.get("provider");
    const providerRef   = searchParams.get("providerRef");

    // ── DB Lookup ────────────────────────────────────────────────────────────
    // Use unscoped client (null) for the initial lookup by reference because
    // the caller does not supply a tenantId. The reference is crypto-random and
    // unguessable, so the lookup itself is safe.
    const globalDb = getTenantClient(null);
    const transaction = await globalDb.transaction.findFirst({
      where: { reference },
      select: {
        id:         true,
        reference:  true,
        status:     true,
        amount:     true,
        planName:   true,
        method:     true,
        createdAt:  true,
        tenantId:   true,
        clientId:   true,
        expiryDate: true,
        client: {
          select: { id: true, username: true },  // phone/macAddress NOT selected — privacy
        },
      },
    });

    // NOTE: we do NOT fall back to tenantPayment here. This is a public
    // hotspot/PPPoE status endpoint. License payments use /api/license/payment-status
    // which is auth-gated. Mixing both here would expose license invoice data publicly.
    if (!transaction) {
      return errorResponse("Transaction not found", 404);
    }

    // Guard: every hotspot/PPPoE transaction must have a tenantId.
    // If it is null something is seriously wrong — do not proceed.
    if (!transaction.tenantId) {
      console.error("[PAYMENTS/STATUS] Transaction has no tenantId — data integrity issue", { reference });
      return errorResponse("Transaction not found", 404);
    }

    // ── Build Response — only safe public fields ──────────────────────────────
    const baseResponse: Record<string, unknown> = {
      reference:   transaction.reference,
      status:      transaction.status,
      amount:      transaction.amount,
      packageName: transaction.planName,
      method:      transaction.method,
      createdAt:   transaction.createdAt,
    };

    // ── If COMPLETED, add connection credentials ──────────────────────────────
    if (transaction.status === "COMPLETED") {
      // Scope to the transaction's own tenant — no cross-tenant leakage
      const db = getTenantClient(transaction.tenantId);
      const subscription = await db.subscription.findFirst({
        where: { clientId: transaction.clientId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { expiresAt: true },
      });

      baseResponse.username    = transaction.client?.username ?? null;
      baseResponse.expiresAt   = subscription?.expiresAt?.toISOString() ?? transaction.expiryDate?.toISOString() ?? null;
      baseResponse.autoConnect = true;
      baseResponse.message     = "Payment confirmed! You can now connect.";

    } else if (transaction.status === "FAILED") {
      baseResponse.message = "Payment failed. Please try again.";

    } else {
      baseResponse.message = "Waiting for payment confirmation...";

      // ── Live provider poll (optional) ─────────────────────────────────────
      // ISOLATION: use the transaction's tenantId to load the TENANT channel.
      // Never use null (platform channel) for a tenant transaction live poll.
      if (providerParam && providerRef && isSupportedProvider(providerParam)) {
        try {
          const liveStatus = await paymentService.checkStatus(
            providerParam.toUpperCase(),
            providerRef,
            transaction.tenantId   // ← tenant's own channel, not platform channel
          );

          baseResponse.liveStatus = liveStatus.status;

          if (liveStatus.status === "COMPLETED") {
            baseResponse.message = "Payment confirmed by provider — processing...";
          } else if (liveStatus.status === "FAILED") {
            baseResponse.message = "Payment failed. Please try again.";
          }
        } catch (pollErr) {
          console.warn("[PAYMENTS/STATUS] Live poll failed:", pollErr);
          // Non-fatal — just don't set liveStatus
        }
      }
    }

    return jsonResponse(baseResponse);

  } catch (e) {
    console.error("[PAYMENTS/STATUS] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
