import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService, sanitizeMikroTikName } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";
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
    const packageId  = String(body.packageId  || body.package_id  || body.package || "");
    const phone      = body.phone || body.phoneNumber || body.phone_number || body.username || body.user;
    const macAddress = body.macAddress || body.mac_address || body.mac;
    const routerId   = String(body.routerId || body.router_id || body.router || "");

    // ── Validation ───────────────────────────────────────────────────────────
    if (!packageId) return errorResponse("Package ID is required", 400);
    if (!phone)     return errorResponse("Phone number is required", 400);

    const phoneDigits = phone.replace(/\D/g, "");
    if (/^\d+$/.test(phone) && phoneDigits.length < 9) {
      return errorResponse("Invalid phone number length", 400);
    }

    const cleanPhone = formatPhoneTZ(phone);

    // ── Find Package ─────────────────────────────────────────────────────────
    let pkg = await prisma.package.findUnique({
      where: { id: packageId },
      include: { router: true },
    });

    if (!pkg) {
      pkg = await prisma.package.findFirst({
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

    // ── Find or Create Client ─────────────────────────────────────────────────
    const existingClient = await prisma.client.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          { phone: phone },
          ...(macAddress ? [{ macAddress }] : []),
        ],
        subscriptions: {
          some: { status: "ACTIVE", expiresAt: { gt: new Date() } },
        },
      },
    });

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      if (macAddress && existingClient.macAddress !== macAddress) {
        await prisma.client.update({
          where: { id: clientId },
          data: { macAddress },
        });
      }
    } else {
      const username = sanitizeMikroTikName(`HS-${cleanPhone.slice(-10)}`);
      let finalUsername = username;
      let suffix = 1;
      while (await prisma.client.findUnique({ where: { username: finalUsername } })) {
        finalUsername = `${username}-${suffix}`;
        suffix++;
      }

      const newClient = await prisma.client.create({
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

    const transaction = await prisma.transaction.create({
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
    // 1. Use provider from request body if given
    // 2. Fall back to tenant's default configured gateway
    // 3. Fall back to first active PaymentChannel
    let provider = (body.provider || body.method || "").toUpperCase();

    if (!provider || provider === "MOBILE_MONEY" || provider === "M-PESA") {
      // Load tenant gateway settings
      const tenantSettings = await prisma.systemSetting.findMany({
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
        const channel = await prisma.paymentChannel.findFirst({
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
        phone: cleanPhone,
        providerName: provider,
        reference,
        description: `Hotspot: ${pkg.name}`,
        buyerName: existingClient?.fullName || `Hotspot ${cleanPhone}`,
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

    if (!paymentInitiated) {
      console.warn(`[HOTSPOT PURCHASE] No payment provider configured for tenant ${pkg.tenantId}. Transaction stays PENDING.`);
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
    case "HOURS":   expiresAt.setHours(expiresAt.getHours()     + pkg.duration); break;
    case "DAYS":    expiresAt.setDate(expiresAt.getDate()        + pkg.duration); break;
    case "MONTHS":  expiresAt.setMonth(expiresAt.getMonth()      + pkg.duration); break;
  }

  await prisma.$transaction(async (tx) => {
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

    // Sync to RADIUS
    const client = await tx.client.findUnique({ where: { id: clientId } });
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
  });

  // MikroTik activation
  if (routerId) {
    try {
      const mikrotik = await getMikroTikService(routerId);
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      const password = client?.phone || "123456";
      await mikrotik.activateService(
        client?.username || `HS-${clientId.slice(0, 8)}`,
        password,
        pkg.name,
        "hotspot",
        expiresAt
      );

      await prisma.routerLog.create({
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
      await prisma.routerLog.create({
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
