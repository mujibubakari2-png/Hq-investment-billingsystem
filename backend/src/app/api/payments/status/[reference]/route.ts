/**
 * GET /api/payments/status/[reference]
 * 
 * Check the current status of a payment transaction by our internal reference.
 * Also optionally polls the provider for live status.
 * 
 * Query params:
 *   - provider (optional) — if provided, polls the live provider API
 *   - providerRef (optional) — provider's own transaction ID for live check
 */

import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { paymentService } from "@/lib/payments/service";
import { isSupportedProvider } from "@/lib/payments/registry";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    if (!reference) return errorResponse("reference is required", 400);

    const { searchParams } = new URL(req.url);
    const providerParam = searchParams.get("provider");
    const providerRef   = searchParams.get("providerRef");

    // ── DB Lookup ────────────────────────────────────────────────────────────
    const transaction = await prisma.transaction.findFirst({
      where: { reference },
      include: {
        client: {
          select: { id: true, username: true, phone: true, macAddress: true },
        },
      },
    });

    if (!transaction) {
      return errorResponse("Transaction not found", 404);
    }

    // ── Build Base Response ──────────────────────────────────────────────────
    const baseResponse: Record<string, unknown> = {
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      packageName: transaction.planName,
      method: transaction.method,
      createdAt: transaction.createdAt,
    };

    // ── If COMPLETED, add connection credentials ─────────────────────────────
    if (transaction.status === "COMPLETED") {
      const subscription = await prisma.subscription.findFirst({
        where: { clientId: transaction.clientId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

      baseResponse.username   = transaction.client.username;
      baseResponse.password   = transaction.client.phone;
      baseResponse.expiresAt  = subscription?.expiresAt?.toISOString() ?? transaction.expiryDate?.toISOString();
      baseResponse.autoConnect = true;
      baseResponse.message    = "Payment confirmed! You can now connect.";
    } else if (transaction.status === "FAILED") {
      baseResponse.message = "Payment failed. Please try again.";
    } else {
      baseResponse.message = "Waiting for payment confirmation...";

      // ── Live provider poll (optional) ────────────────────────────────────
      if (providerParam && providerRef && isSupportedProvider(providerParam)) {
        try {
          const tenantId = transaction.tenantId ?? null;
          const liveStatus = await paymentService.checkStatus(
            providerParam.toUpperCase(),
            providerRef,
            tenantId
          );

          baseResponse.liveStatus = liveStatus.status;

          // If provider says COMPLETED but DB not yet updated (webhook delay)
          if (liveStatus.status === "COMPLETED") {
            baseResponse.message = "Payment confirmed by provider — processing...";
          }
        } catch (pollErr) {
          console.warn("[PAYMENTS/STATUS] Live poll failed:", pollErr);
        }
      }
    }

    return jsonResponse(baseResponse);

  } catch (e) {
    console.error("[PAYMENTS/STATUS] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
