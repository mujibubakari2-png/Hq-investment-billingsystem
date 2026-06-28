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
import prisma from '@/lib/prisma';

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
      paymentContext: 'TENANT',
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
    try {
      const rows = await prisma.systemSetting.findMany({ where: { key: 'paymentGateways' } });
      console.error('[PAYMENTS/INITIATE] paymentGateways rows:', rows.map(r => ({ id: r.id, tenantId: r.tenantId, value: r.value })));
    } catch (dbErr) {
      console.error('[PAYMENTS/INITIATE] failed to read systemSetting.paymentGateways:', dbErr);
    }
    console.error("[PAYMENTS/INITIATE] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
