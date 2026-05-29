/**
 * Central Payment Service Orchestrator
 *
 * Single entry point for all payment operations across providers.
 * Handles: initiation, status checks, webhook processing, logging, idempotency.
 */

import prisma from "@/lib/prisma";
import { getPaymentProvider, isSupportedProvider } from "@/lib/payments/registry";
import {
  PaymentRequest,
  PaymentResponse,
  TransactionStatus,
  WebhookResult,
} from "@/lib/payments/types";
import {
  buildCallbackUrl,
  formatPhoneTZ,
  generateReference,
  isValidAmount,
} from "@/lib/payments/utils";
import { getMikroTikService } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface InitiatePaymentOptions {
  tenantId: string | null;
  amount: number;
  phone: string;
  /** Our reference (e.g. HP-XXXX). If not provided one is auto-generated. */
  reference?: string;
  providerName: string;
  description?: string;
  buyerName?: string;
  buyerEmail?: string;
  /**
   * E19 FIX: Optional pre-built callback URL.
   * When set (e.g. from HotspotSettings.backendUrl), this overrides the global
   * APP_URL so each router can point to its own backend instance.
   * Falls back to buildCallbackUrl(providerName) if not provided.
   */
  callbackUrl?: string;
}

// ─── PaymentService ─────────────────────────────────────────────────────────

export class PaymentService {
  /**
   * Load the active PaymentChannel record for a tenant + provider from DB.
   */
  async getChannel(tenantId: string | null, providerName: string) {
    return prisma.paymentChannel.findFirst({
      where: {
        provider: providerName.toUpperCase(),
        status: "ACTIVE",
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }

  // ── Initiate Payment ────────────────────────────────────────────────────

  async initiatePayment(opts: InitiatePaymentOptions): Promise<PaymentResponse & { reference: string }> {
    const { tenantId, amount, phone, providerName, description, buyerName, buyerEmail } = opts;

    // Validate
    if (!isSupportedProvider(providerName)) {
      return {
        success: false,
        message: `Unsupported provider: ${providerName}`,
        reference: opts.reference ?? "",
      };
    }
    if (!isValidAmount(amount)) {
      return {
        success: false,
        message: `Invalid amount: ${amount}. Must be between 100 and 10,000,000 TZS.`,
        reference: opts.reference ?? "",
      };
    }

    const reference = opts.reference ?? generateReference(providerName.slice(0, 2));
    const cleanPhone = formatPhoneTZ(phone);
    // E19 FIX: Use caller-supplied callbackUrl (e.g. from HotspotSettings.backendUrl) if
    // provided; otherwise fall back to the global buildCallbackUrl() which uses APP_URL.
    const callbackUrl = opts.callbackUrl ?? buildCallbackUrl(providerName);

    // Load provider (DB channel config first, env fallback)
    const channel = await this.getChannel(tenantId, providerName);
    const provider = getPaymentProvider(providerName, channel);

    const request: PaymentRequest = {
      amount,
      phone: cleanPhone,
      reference,
      description,
      callbackUrl,
      buyerName,
      buyerEmail,
    };

    const response = await provider.initiatePayment(request);
    return { ...response, reference };
  }

  // ── Check Status ────────────────────────────────────────────────────────

  async checkStatus(
    providerName: string,
    providerRef: string,
    tenantId: string | null = null
  ): Promise<TransactionStatus> {
    if (!isSupportedProvider(providerName)) {
      return { status: "FAILED" };
    }
    const channel = await this.getChannel(tenantId, providerName);
    const provider = getPaymentProvider(providerName, channel);
    return provider.checkStatus(providerRef);
  }

  // ── Process Webhook ─────────────────────────────────────────────────────

  async processWebhook(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    tenantId: string | null = null
  ): Promise<WebhookResult> {
    if (!isSupportedProvider(providerName)) {
      return { processed: false, message: `Unsupported provider: ${providerName}` };
    }

    const channel = await this.getChannel(tenantId, providerName);
    const provider = getPaymentProvider(providerName, channel);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }

    // 1. Verify webhook authenticity
    const verification = await provider.verifyWebhook(headers, rawBody);

    // 2. Log to webhook_logs regardless of verification result
    const webhookLog = await prisma.webhookLog.create({
      data: {
        provider: providerName.toUpperCase(),
        payload: body as object,
        headers: headers as object,
        verified: verification.verified,
        status: "RECEIVED",
        tenantId: tenantId ?? null,
      },
    });

    if (!verification.verified) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: verification.reason },
      });
      return { processed: false, message: `Webhook rejected: ${verification.reason}` };
    }

    // 3. Parse payload
    const parsed = provider.parseWebhookPayload(body);

    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        transactionRef: parsed.transactionRef || null,
        providerRef: parsed.providerRef || null,
      },
    });

    if (!parsed.transactionRef) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: "Missing transactionRef in payload" },
      });
      return { processed: false, message: "Missing transaction reference in payload" };
    }

    // 4. Idempotency — find existing transaction
    const transaction = await prisma.transaction.findFirst({
      where: { reference: parsed.transactionRef },
      include: { client: true },
    });

    if (!transaction) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: "Transaction not found" },
      });
      return {
        processed: false,
        transactionRef: parsed.transactionRef,
        message: "Transaction not found",
      };
    }

    // Already processed — return early
    if (transaction.status === "COMPLETED") {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "DUPLICATE", processedAt: new Date() },
      });
      return {
        processed: true,
        transactionRef: parsed.transactionRef,
        status: "COMPLETED",
        message: "Already processed",
      };
    }

    // 5. Handle FAILED payment
    if (parsed.resultCode !== "0") {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" },
        });
      });

      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });

      return {
        processed: true,
        transactionRef: parsed.transactionRef,
        status: "FAILED",
        message: parsed.resultMessage ?? "Payment failed",
      };
    }

    // 6. Handle SUCCESSFUL payment
    // E10 FIX: Look up package by packageId stored on Transaction first,
    // fall back to planName (string) only if packageId is absent.
    // This prevents subscription creation failure when a package is renamed.
    const pkg = await prisma.package.findFirst({
      where: transaction.packageId
        ? { id: transaction.packageId }
        : { name: transaction.planName ?? "" },
    });

    // Calculate expiry
    // Bug #15 FIX: If the client already has an active, unexpired subscription for this
    // package, extend from the current expiry date (stack time) instead of starting from
    // now. This prevents customers losing days they already paid for on early renewal.
    const now = new Date();
    let baseDate = now;

    if (pkg) {
      const existingActiveSub = await prisma.subscription.findFirst({
        where: {
          clientId: transaction.clientId,
          packageId: pkg.id,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "desc" },
      });

      if (existingActiveSub) {
        baseDate = existingActiveSub.expiresAt;
      }
    }

    const expiresAt = new Date(baseDate);
    if (pkg) {
      switch (pkg.durationUnit) {
        case "MINUTES": expiresAt.setMinutes(expiresAt.getMinutes() + pkg.duration); break;
        case "HOURS":   expiresAt.setHours(expiresAt.getHours() + pkg.duration); break;
        case "DAYS":    expiresAt.setDate(expiresAt.getDate() + pkg.duration); break;
        case "MONTHS":  expiresAt.setMonth(expiresAt.getMonth() + pkg.duration); break;
      }
    }

    // DB transaction: mark paid, create subscription, activate client
    const [, newSub] = await prisma.$transaction(async (tx) => {
      const updatedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "COMPLETED", expiryDate: expiresAt },
      });

      let sub = null;
      if (pkg) {
        sub = await tx.subscription.create({
          data: {
            clientId: transaction.clientId,
            packageId: pkg.id,
            routerId: pkg.routerId ?? undefined,
            status: "ACTIVE",
            method: "MOBILE",
            activatedAt: now,
            expiresAt,
            onlineStatus: "ONLINE",
            syncStatus: "PENDING",
            tenantId: transaction.tenantId,
          },
        });
      }

      await tx.client.update({
        where: { id: transaction.clientId },
        data: { status: "ACTIVE" },
      });

      return [updatedTx, sub];
    });

    // 7. Sync RADIUS (E09: with compensation on failure)
    if (pkg) {
      try {
        const client = transaction.client;
        let rateLimit: string | undefined;
        if (pkg.uploadSpeed && pkg.downloadSpeed) {
          const ul = pkg.uploadUnit === "Mbps" ? "M" : "k";
          const dl = pkg.downloadUnit === "Mbps" ? "M" : "k";
          rateLimit = `${pkg.uploadSpeed}${ul}/${pkg.downloadSpeed}${dl}`;
        }
        await syncRadiusUser({
          username: client.username,
          password: client.phone || undefined,
          tenantId: pkg.tenantId || null,
          fullName: client.fullName || undefined,
          expiresAt,
          status: "Active",
          rateLimit,
          profileName: pkg.name,
        });
      } catch (radErr) {
        // E09 FIX: RADIUS sync failed — mark subscription for retry instead of
        // silently swallowing the error. A background job can retry PENDING_RADIUS_SYNC.
        console.error(`[PAYMENT SERVICE] RADIUS sync failed — scheduling retry:`, radErr);
        if (newSub?.id) {
          await prisma.subscription.update({
            where: { id: newSub.id },
            data: { syncStatus: "PENDING_RADIUS_SYNC" },
          }).catch((e) => console.error("[PAYMENT SERVICE] Failed to mark PENDING_RADIUS_SYNC:", e));
        }
      }
    }

    // 8. MikroTik activation
    if (pkg?.routerId) {
      try {
        const mikrotik = await getMikroTikService(pkg.routerId);
        const client = transaction.client;
        const pwd = client.phone || "123456";
        const type = client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
        await mikrotik.activateService(client.username, pwd, pkg.name, type, expiresAt);

        if (newSub?.id) {
          await prisma.subscription.update({
            where: { id: newSub.id },
            data: { syncStatus: "SYNCED" },
          });
        }

        await prisma.routerLog.create({
          data: {
            routerId: pkg.routerId,
            action: "PAYMENT_WEBHOOK_ACTIVATED",
            details: `${providerName} payment confirmed: ${parsed.transactionRef}`,
            status: "success",
            username: transaction.client.username,
            tenantId: transaction.tenantId,
          },
        });
      } catch (mkErr: unknown) {
        const msg = mkErr instanceof Error ? mkErr.message : "Unknown";
        console.error(`[PAYMENT SERVICE] MikroTik activation failed:`, msg);
        await prisma.routerLog.create({
          data: {
            routerId: pkg.routerId,
            action: "PAYMENT_WEBHOOK_ACTIVATION_FAILED",
            details: msg,
            status: "error",
            username: transaction.client.username,
          },
        });
      }
    }

    // 9. Mark webhook as processed
    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    console.log(`✅ [PAYMENT SERVICE] ${providerName} webhook processed: ${parsed.transactionRef}`);

    return {
      processed: true,
      transactionRef: parsed.transactionRef,
      status: "COMPLETED",
      message: "Payment confirmed and service activated",
    };
  }
}

// Export singleton
export const paymentService = new PaymentService();
