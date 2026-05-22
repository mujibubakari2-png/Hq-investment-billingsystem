/**
 * POST /api/payments/initiate
 * 
 * Unified payment initiation endpoint for all providers.
 * Body: { provider, amount, phone, reference?, description?, buyerName?, buyerEmail?, tenantId? }
 */

import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { paymentService } from "@/lib/payments/service";
import { isSupportedProvider } from "@/lib/payments/registry";
import { isValidAmount, formatPhoneTZ } from "@/lib/payments/utils";

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const {
      provider,
      amount,
      phone,
      reference,
      description,
      buyerName,
      buyerEmail,
    } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!provider) return errorResponse("provider is required", 400);
    if (!phone) return errorResponse("phone is required", 400);
    if (!amount || isNaN(Number(amount))) return errorResponse("amount must be a number", 400);

    const amountNum = Number(amount);
    if (!isValidAmount(amountNum)) {
      return errorResponse("amount must be between 100 and 10,000,000 TZS", 400);
    }

    if (!isSupportedProvider(provider)) {
      return errorResponse(
        `Unsupported provider "${provider}". Supported: PALMPESA, ZENOPAY, MONGIKE, HARAKAPAY`,
        400
      );
    }

    // Validate phone
    const cleaned = formatPhoneTZ(phone);
    if (cleaned.length < 12) {
      return errorResponse("Invalid phone number", 400);
    }

    // Use tenant from JWT payload (non-super-admin is scoped to their tenant)
    const tenantId = userPayload.role === "SUPER_ADMIN"
      ? (body.tenantId ?? userPayload.tenantId ?? null)
      : userPayload.tenantId ?? null;

    // ── Initiate ────────────────────────────────────────────────────────────
    const result = await paymentService.initiatePayment({
      tenantId,
      amount: amountNum,
      phone: cleaned,
      providerName: provider.toUpperCase(),
      reference,
      description,
      buyerName,
      buyerEmail,
    });

    if (!result.success) {
      return errorResponse(result.message, 502);
    }

    return jsonResponse({
      success: true,
      reference: result.reference,
      providerRef: result.providerRef,
      provider: provider.toUpperCase(),
      message: result.message,
      status: "PENDING",
    }, 200);

  } catch (e) {
    console.error("[PAYMENTS/INITIATE] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
