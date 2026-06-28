import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService, sanitizeMikroTikName } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";
import { buildHotspotPortalFeedback } from "@/lib/hotspotFlow";
import { paymentService } from "@/lib/payments/service";
import { formatPhoneTZ } from "@/lib/payments/utils";

/**
 * POST /api/hotspot/purchase
 *
 * Called from the MikroTik hotspot login page when a client selects a package
 * and enters their phone number to pay.
 *
 * Body: { packageId, phone, macAddress, routerId, provider? }
 *
 * Flow:
 * 1. Validate the package exists and is active
 * 2. Create or find the client by phone/mac
 * 3. Create a PENDING transaction
 * 4. Initiate mobile money push via the configured provider (PaymentService)
 * 5. Return the transaction reference for status polling
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const packageId = String(body.packageId || body.package_id || body.package || "");
    const phone = body.phone || body.phoneNumber || body.phone_number || body.username || body.user;
    const macAddress = body.macAddress || body.mac_address || body.mac;
    const routerId = String(body.routerId || body.router_id || body.router || "");

    // ── Validation ───────────────────────────────────────────────────────────
    if (!routerId) return errorResponse("routerId is required", 400);
    if (!packageId) return errorResponse("Package ID is required", 400);
    if (!phone) return errorResponse("Phone number is required", 400);

    const phoneDigits = phone.replace(/\D/g, "");
    if (/^\d+$/.test(phone) && phoneDigits.length < 9) {
      return errorResponse("Invalid phone number length", 400);
    }

    const cleanPhone = formatPhoneTZ(phone);

    const lookupDb = getTenantClient(null);
    const router = await lookupDb.router.findUnique({
      where: { id: routerId },
      select: { id: true, tenantId: true },
    });
    if (!router) {
      return errorResponse("Router not found", 404);
    }
    if (!router.tenantId) {
      return errorResponse("Invalid router configuration", 400);
    }

    const db = getTenantClient(router.tenantId);

    // ── Find Package ─────────────────────────────────────────────────────────
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
          name: packageId,
          routerId: routerId,
          tenantId: router.tenantId,
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

    // E19 FIX: Look up HotspotSettings.backendUrl for the package's router.
    // This allows each router to override the global APP_URL for payment callbacks,
    // which is essential in multi-region or multi-instance deployments.
    let hotspotBackendUrl: string | null = null;
    if (pkg.routerId) {
      const hs = await db.hotspotSettings.findUnique({
        where: { routerId: pkg.routerId },
        select: { backendUrl: true },
      });
      hotspotBackendUrl = hs?.backendUrl || null;
    }

    // ── Find or Create Client ─────────────────────────────────────────────────
    // E14 FIX: Split the single OR (phone || MAC) query into two sequential lookups.
    // A single OR can merge two completely different clients who happen to share a MAC
    // address (e.g. a device was resold). Phone is the primary identifier; MAC is only
    // used as a fallback when no phone match is found.
    let existingClient = await db.client.findFirst({
      where: {
        tenantId: pkg.tenantId,
        phone: cleanPhone,
        subscriptions: {
          some: { status: "ACTIVE", expiresAt: { gt: new Date() } },
        },
      },
    });

    if (!existingClient && macAddress) {
      existingClient = await db.client.findFirst({
        where: {
          tenantId: pkg.tenantId,
          macAddress,
          subscriptions: {
            some: { status: "ACTIVE", expiresAt: { gt: new Date() } },
          },
        },
      });
    }

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      if (macAddress && existingClient.macAddress !== macAddress) {
        await db.client.update({
          where: { id: clientId },
          data: { macAddress },
        });
      }
    } else {
      const username = sanitizeMikroTikName(`HS-${cleanPhone.slice(-10)}`);
      let finalUsername = username;
      let suffix = 1;
      while (await db.client.findFirst({ where: { username: finalUsername, tenantId: pkg.tenantId } })) {
        finalUsername = `${username}-${suffix}`;
        suffix++;
      }

      const newClient = await db.client.create({
        data: {
          username: finalUsername,
          fullName: `Hotspot ${cleanPhone}`,
          phone: cleanPhone,
          serviceType: "HOTSPOT",
          status: "ACTIVE",
          macAddress: macAddress || null,
          tenantId: pkg.tenantId,
        },
      });
      clientId = newClient.id;
    }

    // ── Create PENDING Transaction ────────────────────────────────────────────
    const reference = `HP-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    const transaction = await db.transaction.create({
      data: {
        clientId,
        planName: pkg.name,
        // E10 FIX: Store packageId so the webhook handler can find the package by ID
        // even if the package name is later renamed. Falls back to planName only if ID lookup fails.
        packageId: pkg.id,
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
    // 1. Use provider from request body if given
    // 2. Fall back to tenant's default configured gateway
    // 3. Fall back to first active PaymentChannel
    let provider = (body.provider || body.method || "").toUpperCase();

    if (!provider || provider === "MOBILE_MONEY" || provider === "M-PESA") {
      // Load tenant gateway settings
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
        // Try first active PaymentChannel for this tenant
        const channel = await db.paymentChannel.findFirst({
          where: {
            status: "ACTIVE",
            ...(pkg.tenantId ? { tenantId: pkg.tenantId } : {}),
          },
        });
        if (channel?.provider) {
          provider = channel.provider.toUpperCase();
        } else {
          // PAY-001 FIX: No provider configured — return error instead of defaulting to ZENOPAY.
          // Silently defaulting causes payment initiation to fail for tenants using other providers,
          // and would mark the transaction as PENDING with no way to recover.
          await db.transaction.update({
            where: { id: transaction.id },
            data: { status: "FAILED" },
          });
          return errorResponse(
            "No payment provider is configured for this tenant. Please contact support.",
            503
          );
        }
      }
    }

    // ── Initiate Payment via PaymentService ───────────────────────────────────
    let providerRef: string | undefined;
    let paymentInitiated = false;

    try {
      // E19 FIX: Build callback URL from HotspotSettings.backendUrl if configured,
      // falling back to the global APP_URL via buildCallbackUrl() inside PaymentService.
      const callbackUrlOverride = hotspotBackendUrl
        ? `${hotspotBackendUrl.replace(/\/$/, "")}/api/webhooks/${provider.toLowerCase()}`
        : undefined;

      const result = await paymentService.initiatePayment({
        tenantId: pkg.tenantId ?? null,
        amount: pkg.price,
        phone: cleanPhone,
        providerName: provider,
        reference,
        description: `Hotspot: ${pkg.name}`,
        buyerName: existingClient?.fullName || `Hotspot ${cleanPhone}`,
        callbackUrl: callbackUrlOverride,
        paymentContext: 'TENANT',
      });

      if (result.success) {
        providerRef = result.providerRef;
        paymentInitiated = true;
      } else {
        console.warn(`[HOTSPOT PURCHASE] Payment initiation failed: ${result.message}`);
      }
    } catch (payErr) {
      console.error("[HOTSPOT PURCHASE] PaymentService error:", payErr);
    }

    const purchaseFeedback = paymentInitiated
      ? buildHotspotPortalFeedback({ kind: 'payment', state: 'pending' })
      : undefined;

    if (!paymentInitiated) {
      console.warn(`[HOTSPOT PURCHASE] No payment provider configured for tenant ${pkg.tenantId}. Transaction stays PENDING.`);
    }

    return jsonResponse({
      success: true,
      title: purchaseFeedback?.title,
      message: purchaseFeedback?.message || "Payment provider not configured. Please contact support.",
      autoConnect: purchaseFeedback?.autoConnect ?? false,
      reference,
      transactionId: transaction.id,
      purchase_id: transaction.id,
      checkoutRequestId: providerRef ?? null,
      status: "PENDING",
      packageName: pkg.name,
      amount: pkg.price,
      provider,
      initiated: paymentInitiated,
    });

  } catch (e) {
    console.error("[HOTSPOT PURCHASE] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * Complete a hotspot purchase after payment confirmation.
 * Called by the central PaymentService webhook handler (in service.ts).
 * Left here for any direct manual activation flows.
 */
async function completeHotspotPurchase(
  transactionId: string,
  reference: string,
  clientId: string,
  pkg: {
    id: string;
    name: string;
    duration: number;
    durationUnit: string;
    uploadSpeed: number;
    uploadUnit: string;
    downloadSpeed: number;
    downloadUnit: string;
    routerId: string | null;
    tenantId: string | null;
  },
  routerId: string | null | undefined
) {
  const now = new Date();
  const expiresAt = new Date(now);

  switch (pkg.durationUnit) {
    case "MINUTES": expiresAt.setMinutes(expiresAt.getMinutes() + pkg.duration); break;
    case "HOURS": expiresAt.setHours(expiresAt.getHours() + pkg.duration); break;
    case "DAYS": expiresAt.setDate(expiresAt.getDate() + pkg.duration); break;
    case "MONTHS": expiresAt.setMonth(expiresAt.getMonth() + pkg.duration); break;
  }

  const tenantDb = getTenantClient(pkg.tenantId);
  await tenantDb.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "COMPLETED", expiryDate: expiresAt },
    });

    await tx.subscription.create({
      data: {
        clientId,
        packageId: pkg.id,
        routerId: routerId || pkg.routerId || undefined,
        status: "ACTIVE",
        method: "MOBILE",
        activatedAt: now,
        expiresAt,
        onlineStatus: "ONLINE",
        syncStatus: "SYNCED",
      },
    });

    await tx.client.update({
      where: { id: clientId },
      data: { status: "ACTIVE" },
    });
  });

  // Sync to RADIUS
  try {
    const db = getTenantClient(pkg.tenantId);
    const client = await db.client.findUnique({ where: { id: clientId } });
    if (client) {
      let rateLimit: string | undefined;
      if (pkg.uploadSpeed && pkg.downloadSpeed) {
        const ul = pkg.uploadUnit === "Mbps" ? "M" : "k";
        const dl = pkg.downloadUnit === "Mbps" ? "M" : "k";
        rateLimit = `${pkg.uploadSpeed}${ul}/${pkg.downloadSpeed}${dl}`;
      }
      await syncRadiusUser({
        username: client.username,
        password: client.phone || "123456",
        tenantId: pkg.tenantId || null,
        fullName: client.fullName || undefined,
        expiresAt,
        status: "Active",
        profileName: pkg.name,
        rateLimit,
      });
    }
  } catch (radErr) {
    console.error("[HOTSPOT] RADIUS sync error:", radErr);
  }

  // MikroTik activation
  if (routerId) {
    try {
      const mikrotik = await getMikroTikService(routerId);
      const db = getTenantClient(pkg.tenantId);
      const client = await db.client.findUnique({ where: { id: clientId } });
      const password = client?.phone || "123456";
      await mikrotik.activateService(
        client?.username || `HS-${clientId.slice(0, 8)}`,
        password,
        pkg.name,
        "hotspot",
        expiresAt
      );

      await db.routerLog.create({
        data: {
          routerId,
          action: "HOTSPOT_USER_CREATED",
          details: `Payment confirmed for ${reference} (${pkg.name})`,
          status: "success",
          username: client?.username || `HS-${clientId.slice(0, 8)}`,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      const db = getTenantClient(pkg.tenantId);
      await db.routerLog.create({
        data: {
          routerId,
          action: "HOTSPOT_USER_CREATED_FAILED",
          details: `Router offline: ${msg}`,
          status: "error",
          username: `HS-${clientId.slice(0, 8)}`,
        },
      });
    }
  }

  console.log(`✅ [HOTSPOT] Purchase complete: ${reference} → ${pkg.name}`);
}
