/**
 * POST /api/payments/initiate
 * 
 * Unified payment initiation endpoint for all providers.
 * Body: { provider, amount, phone, reference?, description?, buyerName?, buyerEmail?, tenantId? }
 */

import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant, getAssignTenantId } from '@/lib/tenant';
import { paymentService } from "@/lib/payments/service";
import { isSupportedProvider, SUPPORTED_PROVIDERS } from "@/lib/payments/registry";
import { isValidAmount, formatPhoneTZ } from "@/lib/payments/utils";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const guard = requirePermission(req, "transactions:write");
    if (guard.error) return guard.error;
    const userPayload = guard.user;

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
      // Bug #4 FIX: Dynamically list supported providers from registry
      return errorResponse(
        `Unsupported provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
        400
      );
    }

    // Validate phone
    const cleaned = formatPhoneTZ(phone);
    if (cleaned.length < 12) {
      return errorResponse("Invalid phone number", 400);
    }

    // Use tenant from JWT payload (non-super-admin is scoped to their tenant)
    const tenantId = getAssignTenantId(userPayload, body.tenantId ?? null);

    // Ensure the acting user can access the target tenant
    if (!canAccessTenant(userPayload, tenantId)) {
      return errorResponse("Forbidden", 403);
    }
    if (!tenantId) {
      return errorResponse("Tenant payment initiation requires a tenantId", 400);
    }
    if (!reference) {
      return errorResponse("reference is required. Create a transaction first via the Hotspot, PPPoE, or invoice payment flow.", 400);
    }

    const db = getTenantClient(tenantId);

    // HIGH-DATA FIX: Atomically claim the PENDING transaction before calling
    // the payment gateway. The old pattern (findFirst → initiatePayment → update)
    // had a TOCTOU race: two concurrent requests could both see PENDING, both call
    // the gateway, and double-charge the customer.
    //
    // Fix: use updateMany() with status=PENDING in the WHERE clause to atomically
    // flip status to INITIATING. Only one request will get rowsUpdated > 0.
    // Any racing duplicate gets a 409 immediately.
    const claimed = await db.transaction.updateMany({
      where: { reference, tenantId, type: "MOBILE", status: "PENDING" },
      data:  { status: "INITIATING" },
    });

    if (claimed.count === 0) {
      // Either not found, wrong amount, or already claimed by another request
      const existing = await db.transaction.findFirst({
        where: { reference, tenantId },
        select: { status: true, amount: true },
      });
      if (!existing) return errorResponse("Pending tenant transaction not found for this reference", 404);
      if (existing.status === "INITIATING" || existing.status !== "PENDING") {
        return errorResponse("Payment already in progress for this reference", 409);
      }
      return errorResponse("Pending tenant transaction not found for this reference", 404);
    }

    // Fetch the claimed transaction to validate amount
    const existingTransaction = await db.transaction.findFirst({
      where: { reference, tenantId, type: "MOBILE", status: "INITIATING" },
      select: { id: true, amount: true },
    });

    if (!existingTransaction) {
      return errorResponse("Transaction claim lost — concurrent request won the race", 409);
    }

    if (Math.round(existingTransaction.amount) !== Math.round(amountNum)) {
      // Roll back the status claim before rejecting
      await db.transaction.updateMany({
        where: { id: existingTransaction.id },
        data:  { status: "PENDING" },
      });
      return errorResponse("Payment amount does not match the pending transaction", 400);
    }

    // ── Initiate ───────────────────────────────────────────────────────────────
    const result = await paymentService.initiatePayment({
      tenantId,
      amount: amountNum,
      phone: cleaned,
      providerName: provider.toUpperCase(),
      reference,
      description,
      buyerName,
      buyerEmail,
      paymentContext: "TENANT",
    });

    if (!result.success) {
      // Roll back status so it can be retried
      await db.transaction.updateMany({
        where: { id: existingTransaction.id },
        data:  { status: "PENDING" },
      });
      return errorResponse(result.message, 502);
    }

    // Update the claimed transaction with providerRef + PENDING (gateway accepted it)
    await db.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        providerRef: result.providerRef,
        method: provider.toUpperCase(),
        status: "PENDING",
      },
    });

    return jsonResponse({
      success: true,
      reference: result.reference,
      providerRef: result.providerRef,
      provider: provider.toUpperCase(),
      message: result.message,
      status: "PENDING",
    }, 200);

  } catch (e) {
    logger.error('[payments/initiate] Error', { error: e instanceof Error ? e.message : String(e) });
    return errorResponse("Internal server error", 500);
  }
}
