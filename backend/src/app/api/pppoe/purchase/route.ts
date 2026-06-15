import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { paymentService } from "@/lib/payments/service";
import { formatPhoneTZ } from "@/lib/payments/utils";

/**
 * POST /api/pppoe/purchase
 *
 * Self-service payment portal for PPPoE clients.
 *
 * Body: { username, packageId, phone, provider? }
 *
 * Flow:
 * 1. Validate the package exists and is active
 * 2. Find the PPPoE client by username or phone
 * 3. Create a PENDING transaction
 * 4. Initiate mobile money push via the configured provider
 * 5. Return the transaction reference for status polling
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const packageId = String(body.packageId || body.package_id || body.package || "");
    const routerId = String(body.routerId || body.router_id || body.router || "");
    const username = body.username || body.user || "";
    const phone = body.phone || body.phoneNumber || body.phone_number || "";

    // ── Validation ───────────────────────────────────────────────────────────
    if (!routerId) return errorResponse("routerId is required", 400);
    if (!packageId) return errorResponse("Package ID is required", 400);
    if (!username && !phone) return errorResponse("Username or phone number is required to find your account", 400);

    let cleanPhone = phone ? formatPhoneTZ(phone) : undefined;

    // ── Find Package ─────────────────────────────────────────────────────────
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      select: { id: true, tenantId: true },
    });
    if (!router) {
      return errorResponse("Router not found", 404);
    }

    const db = getTenantClient(router.tenantId);

    let pkg = await db.package.findUnique({
      where: { id: packageId },
      include: { router: true },
    });

    if (pkg) {
      if (pkg.tenantId !== router.tenantId) {
        pkg = null;
      } else if (pkg.routerId && pkg.routerId !== routerId) {
        pkg = null;
      }
    }

    if (!pkg) {
      pkg = await db.package.findFirst({
        where: {
          OR: [
            { name: packageId },
            ...(/^\d+$/.test(packageId) ? [{ status: "ACTIVE" as const }] : []),
            ...(process.env.NODE_ENV !== "production" ? [{ status: "ACTIVE" as const }] : []),
          ],
        },
        include: { router: true },
      });
    }

    if (!pkg || pkg.status !== "ACTIVE") {
      return errorResponse("Package not found or inactive", 404);
    }

    const amount = pkg.price;
    if (amount < 100) {
      return errorResponse("Package price is too low (minimum 100 TZS)", 402);
    }

    // ── Find Client ─────────────────────────────────────────────────────────
    const existingClient = await db.client.findFirst({
      where: {
        serviceType: "PPPOE",
        OR: [
          ...(username ? [{ username }] : []),
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (!existingClient) {
      return errorResponse("PPPoE client not found. Please contact support.", 404);
    }

    const clientId = existingClient.id;

    // If client provided a phone during purchase but we matched by username, we use the provided phone for payment
    const paymentPhone = cleanPhone || existingClient.phone;
    if (!paymentPhone) {
      return errorResponse("No phone number available for payment.", 400);
    }

    // ── Create PENDING Transaction ────────────────────────────────────────────
    const reference = `PP-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    const transaction = await db.transaction.create({
      data: {
        clientId,
        planName: pkg.name,
        amount: pkg.price,
        type: "MOBILE",
        method: "MOBILE_MONEY",
        status: "PENDING",
        reference,
        expiryDate: null,
        tenantId: pkg.tenantId,
      },
    });

    // ── Resolve Provider ──────────────────────────────────────────────────────
    let provider = (body.provider || body.method || "").toUpperCase();

    if (!provider || provider === "MOBILE_MONEY" || provider === "M-PESA") {
      const tenantSettings = await db.systemSetting.findMany({
        where: { tenantId: pkg.tenantId ?? null },
      });

      const gwSetting = tenantSettings.find((s) => s.key === "paymentGateways");
      let gateways: { name: string; isDefault?: boolean; enabled?: boolean }[] = [];
      if (gwSetting) {
        try { gateways = JSON.parse(gwSetting.value); } catch { /* ignore */ }
      }

      const defaultGw =
        gateways.find((g) => g.isDefault && g.enabled) ||
        gateways.find((g) => g.enabled);

      if (defaultGw) {
        provider = defaultGw.name.toUpperCase();
      } else {
        const channel = await db.paymentChannel.findFirst({
          where: {
            status: "ACTIVE",
            ...(pkg.tenantId ? { tenantId: pkg.tenantId } : {}),
          },
        });
        provider = channel?.provider?.toUpperCase() ?? "ZENOPAY";
      }
    }

    // ── Initiate Payment via PaymentService ───────────────────────────────────
    let providerRef: string | undefined;
    let paymentInitiated = false;

    try {
      const result = await paymentService.initiatePayment({
        tenantId: pkg.tenantId ?? null,
        amount: pkg.price,
        phone: paymentPhone,
        providerName: provider,
        reference,
        description: `PPPoE: ${pkg.name}`,
        buyerName: existingClient.fullName || `PPPoE ${existingClient.username}`,
      });

      if (result.success) {
        providerRef = result.providerRef;
        paymentInitiated = true;
      } else {
        console.warn(`[PPPOE PURCHASE] Payment initiation failed: ${result.message}`);
      }
    } catch (payErr) {
      console.error("[PPPOE PURCHASE] PaymentService error:", payErr);
    }

    if (!paymentInitiated) {
      console.warn(`[PPPOE PURCHASE] No payment provider configured for tenant ${pkg.tenantId}. Transaction stays PENDING.`);
    }

    return jsonResponse({
      success: true,
      message: paymentInitiated
        ? "Payment initiated. Check your phone for the payment prompt."
        : "Payment provider not configured. Please contact support.",
      reference,
      transactionId: transaction.id,
      purchase_id: transaction.id,
      checkoutRequestId: providerRef ?? null,
      status: "PENDING",
      packageName: pkg.name,
      amount: pkg.price,
      provider,
      initiated: paymentInitiated,
      username: existingClient.username
    });

  } catch (e) {
    console.error("[PPPOE PURCHASE] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
