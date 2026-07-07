/**
 * Central Payment Service Orchestrator
 *
 * Single entry point for all payment operations across providers.
 * Handles: initiation, status checks, webhook processing, logging, idempotency.
 */

import { getTenantClient } from "@/lib/tenantPrisma";
import { getPaymentProvider, isSupportedProvider, ChannelRecord } from "@/lib/payments/registry";
import {
  PaymentRequest,
  PaymentResponse,
  TransactionStatus,
  WebhookResult,
  WebhookVerification,
} from "@/lib/payments/types";
import {
  buildCallbackUrl,
  formatPhoneTZ,
  generateReference,
  isValidAmount,
} from "@/lib/payments/utils";
import { getMikroTikService } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";
import logger from "@/lib/logger";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * PAYMENT ARCHITECTURE â€” CREDENTIAL ISOLATION CONTRACT
 * =====================================================
 * This system operates two completely separate payment contexts:
 *
 * LICENSE context  (paymentContext = "LICENSE"):
 *   - Used for: License Purchase, License Renewal, SaaS Subscription Payments.
 *   - Credentials: Platform Super Admin's PaymentChannel (tenantId = null).
 *   - Money flows to: Platform Owner only.
 *   - Route: POST /api/license/renew â†’ this service with tenantId = null.
 *
 * TENANT context   (paymentContext = "TENANT"):
 *   - Used for: Hotspot customer payments, PPPoE customer payments.
 *   - Credentials: Tenant Super Admin's PaymentChannel (tenantId = <value>).
 *   - Money flows to: That specific tenant only.
 *   - Route: POST /api/payments/initiate â†’ this service with tenantId = <value>.
 *
 * ENFORCEMENT: getChannel() enforces this contract and throws if there is a
 * context mismatch. This prevents any cross-contamination of credentials.
 */
export type PaymentContext = "LICENSE" | "TENANT";

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
  /**
   * Explicit payment context to enforce credential isolation at the service boundary.
   * LICENSE => platform channel (tenantId=null)
   * TENANT => tenant channel (tenantId=<value>)
   */
  paymentContext?: PaymentContext;
}

// â”€â”€â”€ PaymentService â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export class PaymentService {
  /**
   * Load the active PaymentChannel record for a tenant + provider from DB.
   */
  async getChannel(
    tenantId: string | null,
    providerName: string,
    paymentContext?: PaymentContext
  ) {
    logger.info("[TRACE][PaymentService.getChannel] ENTER", { tenantId, providerName, paymentContext });
    const ctx = paymentContext ?? (tenantId === null ? "LICENSE" : "TENANT");

    if (ctx === "LICENSE" && tenantId !== null) {
      logger.error("[TRACE][PaymentService.getChannel] EARLY_RETURN", { reason: "LICENSE context requires tenantId=null" });
      throw new Error(
        `[PAYMENT ISOLATION VIOLATION] LICENSE context requires tenantId=null (platform channel), ` +
        `but got tenantId="${tenantId}". ` +
        `Platform credentials must never be used for Hotspot or PPPoE payments.`
      );
    }
    if (ctx === "TENANT" && !tenantId) {
      logger.error("[TRACE][PaymentService.getChannel] EARLY_RETURN", { reason: "TENANT context requires a tenantId" });
      throw new Error(
        `[PAYMENT ISOLATION VIOLATION] TENANT context requires a non-null tenantId, ` +
        `but got tenantId=null. ` +
        `Tenant credentials must never be used for License payments.`
      );
    }

    const db = getTenantClient(tenantId);
    const channel = await db.paymentChannel.findFirst({
      where: {
        provider: providerName.toUpperCase(),
        status: "ACTIVE",
        tenantId: tenantId ?? null,
      },
    });

    // SECURITY FIX: never log the full `channel` record — it carries
    // apiKey/apiSecret/webhookSecret (encrypted at rest, but there is no
    // reason to also ship the ciphertext to a third-party log aggregator).
    // Log only non-sensitive identifiers instead.
    logger.info("[TRACE][PaymentService.getChannel] EXIT", {
      tenantId,
      providerName,
      channelId: channel?.id ?? null,
      channelFound: !!channel,
    });
    return channel;
  }

  // â”€â”€ Initiate Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async initiatePayment(opts: InitiatePaymentOptions): Promise<PaymentResponse & { reference: string }> {
    logger.info("[TRACE][PaymentService.initiatePayment] ENTER", { opts });
    const { tenantId, amount, phone, providerName, description, buyerName, buyerEmail, paymentContext } = opts;

    if (!isSupportedProvider(providerName)) {
      logger.error("[TRACE][PaymentService.initiatePayment] EARLY_RETURN", { reason: "unsupported provider", providerName });
      return { success: false, message: `Unsupported provider: ${providerName}`, reference: opts.reference ?? "" };
    }
    if (!isValidAmount(amount)) {
      logger.error("[TRACE][PaymentService.initiatePayment] EARLY_RETURN", { reason: "invalid amount", amount });
      return { success: false, message: `Invalid amount: ${amount}. Must be between 100 and 10,000,000 TZS.`, reference: opts.reference ?? "" };
    }

    const reference = opts.reference ?? generateReference(providerName.slice(0, 2));
    const cleanPhone = formatPhoneTZ(phone);
    const callbackUrl = opts.callbackUrl ?? buildCallbackUrl(providerName);
    logger.info("[TRACE][PaymentService.initiatePayment] CALLBACK", { providerName, callbackUrl, phone: cleanPhone });

    const globalDb = getTenantClient(null);
    let db = getTenantClient(tenantId);
    let existingTx: { status?: string } | null = null;
    try {
      existingTx = await db.transaction.findFirst({
        where: { reference, tenantId: tenantId ?? null },
      });
    } catch (error: any) {
      const code = error?.code;
      const message = error?.message || String(error);
      logger.warn("[TRACE][PaymentService.initiatePayment] IDENTITY_CHECK_FAILED", { reference, code, message });
      if (code === "P2021" || /table .*transactions.* does not exist/i.test(message)) {
        logger.warn("[TRACE][PaymentService.initiatePayment] CONTINUING_WITHOUT_IDENTITY_CHECK", { reference });
      } else {
        throw error;
      }
    }
    if (existingTx) {
      logger.info("[TRACE][PaymentService.initiatePayment] EXISTING_TRANSACTION", { reference, status: existingTx.status });
      if (existingTx.status === "COMPLETED") {
        return { success: true, message: "Payment already completed", reference, idempotent: true } as any;
      }
      if (existingTx.status === "PENDING") {
        return { success: true, message: "Payment already initiated and is pending", reference, idempotent: true } as any;
      }
    }

    const channel = await this.getChannel(tenantId, providerName, paymentContext);
    const provider = getPaymentProvider(providerName, channel);
    // SECURITY FIX: log only the channel id, not the full record (see getChannel() fix above).
    logger.info("[TRACE][PaymentService.initiatePayment] PROVIDER_SELECTED", { providerName, providerClass: provider.constructor?.name, channelId: (channel as any)?.id ?? null });

    const request: PaymentRequest = { amount, phone: cleanPhone, reference, description, callbackUrl, buyerName, buyerEmail };

    logger.info("[TRACE][PaymentService.initiatePayment] CALLING_PROVIDER", { providerName, request });
    const response = await provider.initiatePayment(request);
    logger.info("[TRACE][PaymentService.initiatePayment] EXIT", { providerName, response, reference });
    return { ...response, reference };
  }

  // â”€â”€ Check Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Resolve Webhook Channel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * MULTI-TENANT WEBHOOK ISOLATION FIX
   * ===================================
   * Provider webhook callback URLs (e.g. /api/webhooks/palmpesa) are SHARED across
   * every tenant using that provider â€” the provider has no concept of "tenant" and
   * posts to one fixed callback URL per provider. When the webhook arrives we do NOT
   * yet know which tenant (or the platform) it belongs to â€” that is only knowable
   * AFTER the payload is parsed and matched against a transaction/invoice.
   *
   * BUG (pre-fix): processWebhook() always called getChannel(tenantId, providerName)
   * with tenantId fixed at whatever the caller passed in (typically null from the
   * shared /api/webhooks/{provider} routes). Because getChannel() defaults its
   * paymentContext to "LICENSE" whenever tenantId is null, this silently picked the
   * PLATFORM (tenantId=null) PaymentChannel ONLY â€” even for webhooks that actually
   * belong to a tenant's Hotspot/PPPoE payment. Concretely this meant:
   *   - A tenant's own webhookSecret/apiKey credentials were NEVER used to verify
   *     that tenant's incoming webhook; verification ran against the platform's
   *     credentials instead.
   *   - If a tenant's PaymentChannel secret differs from the platform's (the normal
   *     case â€” each tenant configures their own credentials from the frontend),
   *     every legitimate tenant webhook would be rejected as "signature mismatch".
   *   - If a tenant's PaymentChannel secret happened to collide with the platform's,
   *     the wrong channel's identity/credentials would silently be used.
   *
   * FIX: when the tenant is not explicitly known, try EVERY ACTIVE PaymentChannel
   * configured for this provider â€” the platform's channel AND every tenant's own
   * channel â€” and accept the first one whose verifyWebhook() succeeds. Each tenant's
   * credentials are isolated and are only ever compared against that tenant's own
   * channel, never cross-applied to another tenant or to the platform.
   */
  async completeTenantTransactionFromStatus(
    reference: string,
    providerName: string,
    providerRef?: string | null,
    paidAmount?: number
  ): Promise<{ completed: boolean; status?: string; message: string; expiresAt?: Date | null; username?: string | null }> {
    const globalDb = getTenantClient(null);
    const transaction = await (globalDb.transaction.findFirst as any)({
      where: {
        reference,
        type: "MOBILE",
        tenantId: { not: null },
      },
      include: { client: true, invoice: true },
    }) as any;

    if (!transaction) {
      return { completed: false, message: "Transaction not found" };
    }
    if (!transaction.tenantId) {
      return { completed: false, message: "Tenant transaction is missing tenantId" };
    }
    if (transaction.status === "COMPLETED") {
      return {
        completed: true,
        status: "COMPLETED",
        message: "Already completed",
        expiresAt: transaction.expiryDate ?? null,
        username: transaction.client?.username ?? null,
      };
    }

    const db = getTenantClient(transaction.tenantId);

    if (paidAmount !== undefined && paidAmount < transaction.amount) {
      await db.transaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });
      return { completed: false, status: "FAILED", message: "Payment amount does not match transaction amount" };
    }

    const pkg = await db.package.findFirst({
      where: transaction.packageId
        ? { id: transaction.packageId, tenantId: transaction.tenantId }
        : { name: transaction.planName ?? "", tenantId: transaction.tenantId },
    });

    let duplicateDetected = false;
    const result = await db.$transaction(async (tx: any) => {
      const now = new Date();
      let baseDate = now;

      if (pkg) {
        const existingActiveSub = await tx.subscription.findFirst({
          where: { clientId: transaction.clientId, packageId: pkg.id, status: "ACTIVE", expiresAt: { gt: now } },
          orderBy: { expiresAt: "desc" },
        });
        if (existingActiveSub) baseDate = existingActiveSub.expiresAt;
      }

      const expiresAt = new Date(baseDate);
      if (pkg) {
        switch (pkg.durationUnit) {
          case "MINUTES": expiresAt.setMinutes(expiresAt.getMinutes() + pkg.duration); break;
          case "HOURS": expiresAt.setHours(expiresAt.getHours() + pkg.duration); break;
          case "DAYS": expiresAt.setDate(expiresAt.getDate() + pkg.duration); break;
          case "MONTHS": expiresAt.setMonth(expiresAt.getMonth() + pkg.duration); break;
        }
      }

      const updateResult = await tx.transaction.updateMany({
        where: { id: transaction.id, status: { not: "COMPLETED" } },
        data: {
          status: "COMPLETED",
          expiryDate: expiresAt,
          ...(providerRef ? { providerRef } : {}),
          method: providerName.toUpperCase(),
        },
      });

      if (updateResult.count === 0) {
        duplicateDetected = true;
        return { sub: null, expiresAt };
      }

      if ((transaction as any).invoiceId) {
        await (tx.invoice.update as any)({
          where: { id: (transaction as any).invoiceId },
          data: { status: "PAID", paidAt: now, transactionId: transaction.id },
        });
      }

      let sub = null;
      if (pkg) {
        const existingSub = await tx.subscription.findFirst({
          where: { clientId: transaction.clientId, packageId: pkg.id, status: "ACTIVE" },
        });
        if (existingSub) {
          sub = await tx.subscription.update({
            where: { id: existingSub.id },
            data: { expiresAt, updatedAt: new Date(), syncStatus: "PENDING", onlineStatus: "ONLINE" },
          });
        } else {
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
      }

      await tx.client.update({ where: { id: transaction.clientId }, data: { status: "ACTIVE" } });
      return { sub, expiresAt };
    });

    if (duplicateDetected) {
      return {
        completed: true,
        status: "COMPLETED",
        message: "Already processed concurrently",
        expiresAt: result.expiresAt,
        username: transaction.client?.username ?? null,
      };
    }

    const { sub: newSub } = result;

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
          password: client.phone || client.username,
          tenantId: pkg.tenantId || null,
          fullName: client.fullName || undefined,
          expiresAt: (newSub as any)?.expiresAt ?? result.expiresAt,
          status: "Active",
          rateLimit,
          profileName: pkg.name,
        });
      } catch (radErr) {
        logger.error(`[PAYMENT SERVICE] RADIUS sync failed during status completion:`, { detail: radErr instanceof Error ? radErr.message : String(radErr) });
        if (newSub?.id) {
          await db.subscription.update({
            where: { id: newSub.id },
            data: { syncStatus: "PENDING_RADIUS_SYNC" },
          }).catch((e) => logger.error("[PAYMENT SERVICE] Failed to mark PENDING_RADIUS_SYNC:", { detail: e instanceof Error ? e.message : String(e) }));
        }
      }
    }

    if (pkg?.routerId) {
      try {
        const mikrotik = await getMikroTikService(pkg.routerId, pkg.tenantId ?? null);
        const client = transaction.client;
        const pwd = client.phone || "123456";
        const type = client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
        await mikrotik.activateService(client.username, pwd, pkg.name, type, (newSub as any)?.expiresAt ?? result.expiresAt);
        if (newSub?.id) {
          await db.subscription.update({ where: { id: newSub.id }, data: { syncStatus: "SYNCED" } });
        }
        await db.routerLog.create({
          data: {
            routerId: pkg.routerId,
            action: "PAYMENT_STATUS_ACTIVATED",
            details: `${providerName} status confirmed: ${reference}`,
            status: "success",
            username: transaction.client.username,
            tenantId: transaction.tenantId,
          },
        });
      } catch (mkErr: unknown) {
        const msg = mkErr instanceof Error ? mkErr.message : "Unknown";
        logger.error("[PAYMENT SERVICE] MikroTik activation failed during status completion:", { error: msg });
        await db.routerLog.create({
          data: {
            routerId: pkg.routerId,
            action: "PAYMENT_STATUS_ACTIVATION_FAILED",
            details: msg,
            status: "error",
            username: transaction.client.username,
            tenantId: transaction.tenantId,
          },
        }).catch(() => {});
      }
    }

    return {
      completed: true,
      status: "COMPLETED",
      message: "Payment processed successfully",
      expiresAt: (newSub as any)?.expiresAt ?? result.expiresAt,
      username: transaction.client?.username ?? null,
    };
  }

  async completeLicenseInvoiceFromStatus(
    invoiceNumber: string,
    providerRef?: string | null,
    paidAmount?: number
  ): Promise<{ completed: boolean; status?: string; message: string; expiresAt?: Date | null }> {
    const globalDb = getTenantClient(null);
    const invoice = await globalDb.tenantInvoice.findFirst({
      where: providerRef
        ? { OR: [{ invoiceNumber }, { providerRef }] } as any
        : { invoiceNumber },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        tenant: { include: { plan: true } },
      },
    }) as any;

    if (!invoice) {
      return { completed: false, message: "License invoice not found" };
    }
    if (invoice.status === "PAID") {
      return { completed: true, status: "COMPLETED", message: "License invoice already paid", expiresAt: invoice.tenant?.licenseExpiresAt ?? null };
    }
    if (paidAmount !== undefined && paidAmount < invoice.amount) {
      const tenantPayment = invoice.payments?.[0] ?? null;
      if (tenantPayment) {
        await globalDb.tenantPayment.update({
          where: { id: tenantPayment.id },
          data: { status: "FAILED" },
        }).catch(() => {});
      }
      return { completed: false, status: "FAILED", message: "Payment amount does not match invoice amount" };
    }

    const now = new Date();
    const packageMonths: number = invoice.packageMonths ?? 1;
    const currentExpiry = invoice.tenant?.licenseExpiresAt
      ? new Date(invoice.tenant.licenseExpiresAt)
      : now;
    const baseExpiry = currentExpiry < now ? now : currentExpiry;
    const newExpiry = new Date(baseExpiry);
    newExpiry.setMonth(newExpiry.getMonth() + packageMonths);
    const tenantPayment = invoice.payments?.[0] ?? null;

    await globalDb.$transaction(async (tx: any) => {
      await tx.tenantInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          ...(providerRef ? { providerRef } : {}),
        },
      });

      if (tenantPayment) {
        await tx.tenantPayment.update({
          where: { id: tenantPayment.id },
          data: {
            status: "COMPLETED",
            ...(providerRef ? { transactionId: providerRef } : {}),
          },
        });
      } else {
        await tx.tenantPayment.create({
          data: {
            invoiceId: invoice.id,
            tenantId: invoice.tenantId,
            amount: invoice.amount,
            transactionId: providerRef ?? null,
            status: "COMPLETED",
            paymentMethod: "UNKNOWN",
          },
        });
      }

      await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          licenseExpiresAt: newExpiry,
          status: "ACTIVE",
        },
      });
    });

    return { completed: true, status: "COMPLETED", message: "License renewed successfully", expiresAt: newExpiry };
  }

  private async resolveWebhookChannel(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    explicitTenantId: string | null,
    scope: PaymentContext | "ANY" = "ANY"
  ): Promise<{
    channel: (ChannelRecord & { id: string; tenantId: string | null }) | null;
    provider: ReturnType<typeof getPaymentProvider> | null;
    verification: WebhookVerification;
  }> {
    if (scope === "LICENSE") {
      const channel = await this.getChannel(null, providerName, "LICENSE");
      if (!channel) {
        return {
          channel: null,
          provider: null,
          verification: { verified: false, reason: "No active platform payment channel for this provider" },
        };
      }
      const provider = getPaymentProvider(providerName, channel);
      const verification = await provider.verifyWebhook(headers, rawBody);
      return { channel: channel as any, provider, verification };
    }

    // Caller already knows the tenant explicitly â€” resolve directly and
    // isolate verification to that one tenant's channel only. Used by routes
    // (e.g. /api/payments/{provider}/webhook) that have already determined
    // this is unambiguously a PLATFORM (tenantId=null) callback path.
    if (explicitTenantId !== undefined && explicitTenantId !== null) {
      const channel = await this.getChannel(explicitTenantId, providerName, "TENANT");
      if (!channel) {
        return {
          channel: null,
          provider: null,
          verification: { verified: false, reason: "No active payment channel for this tenant/provider" },
        };
      }
      const provider = getPaymentProvider(providerName, channel);
      const verification = await provider.verifyWebhook(headers, rawBody);
      return { channel: channel as any, provider, verification };
    }

    // Unknown tenant: enumerate every ACTIVE channel for this provider â€” the
    // platform's (tenantId=null) channel AND every tenant's own channel â€” and
    // verify the incoming signature against each one IN ISOLATION until one
    // matches. No tenant's credentials are ever compared against another
    // tenant's webhook; each candidate is tried independently.
    const globalDb = getTenantClient(null);
    const candidateChannels = await globalDb.paymentChannel.findMany({
      where: {
        provider: providerName.toUpperCase(),
        status: "ACTIVE",
        ...(scope === "TENANT" ? { tenantId: { not: null } } : {}),
      },
    });

    let lastReason = "No active payment channel configured for this provider";
    for (const candidate of candidateChannels) {
      const candidateProvider = getPaymentProvider(providerName, candidate as any);
      const verification = await candidateProvider.verifyWebhook(headers, rawBody);
      if (verification.verified) {
        logger.info("[TRACE][PaymentService.resolveWebhookChannel] MATCHED_CHANNEL", {
          providerName,
          channelId: (candidate as any).id,
          tenantId: candidate.tenantId ?? null,
        });
        return { channel: candidate as any, provider: candidateProvider, verification };
      }
      lastReason = verification.reason ?? lastReason;
    }

    return { channel: null, provider: null, verification: { verified: false, reason: lastReason } };
  }

  // â”€â”€ Process Webhook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async processWebhook(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    tenantId: string | null = null,
    options?: { skipLicense?: boolean; skipTenant?: boolean }
  ): Promise<WebhookResult> {
    if (!isSupportedProvider(providerName)) {
      return { processed: false, message: `Unsupported provider: ${providerName}` };
    }

    const webhookScope: PaymentContext | "ANY" =
      options?.skipTenant ? "LICENSE" :
      options?.skipLicense ? "TENANT" :
      tenantId ? "TENANT" :
      "ANY";

    // MULTI-TENANT WEBHOOK ISOLATION FIX: resolve which channel (the platform's
    // or a SPECIFIC tenant's) actually owns this webhook BEFORE trusting it,
    // instead of unconditionally assuming the platform (tenantId=null) channel.
    // See resolveWebhookChannel() doc comment for full rationale.
    const resolved = await this.resolveWebhookChannel(providerName, headers, rawBody, tenantId, webhookScope);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }

    const globalDb = getTenantClient(null);

    if (!resolved.channel || !resolved.provider) {
      // No channel (platform's or any tenant's) could verify this webhook.
      // Log it unscoped (tenant unknown) for audit, then reject â€” this is the
      // ONLY case where we fall back to an unscoped (tenantId=null) log write,
      // because by definition no tenant or platform identity was established.
      await globalDb.webhookLog.create({
        data: {
          provider: providerName.toUpperCase(),
          payload: body as object,
          headers: headers as object,
          verified: false,
          status: "FAILED",
          errorMessage: resolved.verification.reason ?? "No matching payment channel",
          tenantId: null,
        },
      }).catch(() => { /* best-effort logging */ });
      return { processed: false, message: `Webhook rejected: ${resolved.verification.reason ?? "No matching payment channel"}` };
    }

    const provider = resolved.provider;
    const verification = resolved.verification;
    // The resolved channel tells us DEFINITIVELY whether this webhook belongs to
    // the PLATFORM (tenantId=null) or to a SPECIFIC tenant (tenantId=<value>).
    // From this point forward we trust resolvedTenantId, not the caller's
    // original (possibly unknown / always-null-from-shared-routes) tenantId.
    const resolvedTenantId: string | null = resolved.channel.tenantId ?? null;
    let db = getTenantClient(resolvedTenantId);

    // 2. Log to webhook_logs â€” scoped to the tenant whose channel verified this webhook
    const webhookLog = await globalDb.webhookLog.create({
      data: {
        provider: providerName.toUpperCase(),
        payload: body as object,
        headers: headers as object,
        verified: verification.verified,
        status: "RECEIVED",
        tenantId: resolvedTenantId,
      },
    });

    if (!verification.verified) {
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: verification.reason },
      });
      return { processed: false, message: `Webhook rejected: ${verification.reason}` };
    }

    // 3. Parse payload
    const parsed = provider.parseWebhookPayload(body);

    await globalDb.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        transactionRef: parsed.transactionRef || null,
        providerRef: parsed.providerRef || null,
      },
    });

    if (!parsed.transactionRef) {
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: "Missing transactionRef in payload" },
      });
      return { processed: false, message: "Missing transaction reference in payload" };
    }

    let transaction: any = null;

    if (!options?.skipTenant) {
      // 4. Try to find a hotspot/PPPoE transaction.
      //    Primary lookup: by our internal reference.
      //    FIX-PP-002 FALLBACK: PalmPesa Endpoint 02 callback does NOT echo our transaction_id
      //    back. It only returns its own order_id. If the primary lookup fails and we have a
      //    providerRef, try matching by the providerRef stored on the transaction record.
      //    ISOLATION: `db` is already scoped to resolvedTenantId via getTenantClient(), so the
      //    tenant-scoping proxy (tenantPrisma.ts) forces tenantId = resolvedTenantId on every
      //    query automatically. We do NOT need to (and must NOT) pass the caller's original
      //    `tenantId` parameter here, since for shared webhook routes it is always null.
      transaction = await (db.transaction.findFirst as any)({
        where: { reference: parsed.transactionRef },
        include: { client: true, invoice: true },
      }) as any;

      // Fallback: lookup by providerRef (for providers that only echo their own order_id)
      if (!transaction && parsed.providerRef && parsed.providerRef !== parsed.transactionRef) {
        transaction = await (db.transaction.findFirst as any)({
          where: { providerRef: parsed.providerRef },
          include: { client: true, invoice: true },
        }) as any;

        if (transaction) {
          logger.info("[PAYMENT SERVICE] Resolved transaction via providerRef fallback", {
            transactionRef: parsed.transactionRef,
            providerRef: parsed.providerRef,
            transactionId: transaction.id,
          });
        }
      }
    }

    // NOTE: db is already correctly scoped via resolvedTenantId above (set right after
    // channel resolution). We deliberately do NOT re-derive `db` from transaction.tenantId
    // here â€” doing so previously allowed a transaction's OWN tenantId to silently override
    // the tenant whose credentials verified the webhook, which is the isolation violation
    // this fix closes. If they ever disagree, that is a sign of an integrity issue worth
    // surfacing rather than silently trusting the transaction's tenantId.
    if (transaction?.tenantId && transaction.tenantId !== resolvedTenantId) {
      logger.error("[PAYMENT SERVICE] ISOLATION MISMATCH: webhook channel tenant differs from matched transaction tenant", {
        resolvedTenantId,
        transactionTenantId: transaction.tenantId,
        transactionRef: parsed.transactionRef,
      });
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: "Cross-tenant mismatch between webhook channel and matched transaction" },
      });
      return {
        processed: false,
        transactionRef: parsed.transactionRef,
        message: "Transaction not found (cross-tenant mismatch)",
      };
    }

    // â”€â”€ LICENSE PAYMENT FALLBACK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If no hotspot/PPPoE transaction found, check if this is a LICENSE payment â€”
    // but ONLY when the webhook was verified against the PLATFORM channel
    // (resolvedTenantId === null). A webhook verified against a SPECIFIC TENANT's
    // channel must never fall through to license invoice processing â€” that tenant's
    // payment credentials must never be able to mark a platform license invoice as paid.
    if (!transaction) {
      if (options?.skipLicense || resolvedTenantId !== null) {
        if (resolvedTenantId !== null) {
          logger.warn("[PAYMENT SERVICE] Tenant-scoped webhook had no matching transaction â€” refusing license fallback (isolation guard)", {
            resolvedTenantId,
            transactionRef: parsed.transactionRef,
          });
        } else {
          logger.error(`[PAYMENT SERVICE] Transaction not found and skipLicense is true. Reference: ${parsed.transactionRef}`);
        }
        await globalDb.webhookLog.update({
          where: { id: webhookLog.id },
          data: { status: "FAILED", errorMessage: "Tenant transaction not found (License fallback skipped)" },
        });
        return {
          processed: false,
          transactionRef: parsed.transactionRef,
          message: "Transaction not found",
        };
      }

      const licenseResult = await this.processLicenseWebhook(
        parsed,
        webhookLog.id,
        providerName
      );
      if (licenseResult !== null) {
        return licenseResult;
      }

      // Not a license payment either â€” genuine 404
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: "Transaction not found (hotspot, PPPoE, or license)" },
      });
      return {
        processed: false,
        transactionRef: parsed.transactionRef,
        message: "Transaction not found",
      };
    }

    // Already processed â€” return early
    if (transaction.status === "COMPLETED") {
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "DUPLICATE", processedAt: new Date() },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "COMPLETED", message: "Already processed" };
    }

    // 5. Handle FAILED payment
    if (parsed.resultCode !== "0") {
      await db.$transaction(async (tx) => {
        await tx.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
      });
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "FAILED", message: parsed.resultMessage ?? "Payment failed" };
    }

    // 5.5. Verify Amount
    if (parsed.amount !== undefined && parsed.amount < transaction.amount) {
      await db.$transaction(async (tx) => {
        await tx.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } });
      });
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: `Underpaid: Paid ${parsed.amount}, Expected ${transaction.amount}`, processedAt: new Date() },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "FAILED", message: "Payment amount does not match transaction amount" };
    }

    // 6. Handle SUCCESSFUL hotspot/PPPoE payment
    const pkg = await db.package.findFirst({
      where: transaction.packageId
        ? { id: transaction.packageId, tenantId: transaction.tenantId }
        : { name: transaction.planName ?? "", tenantId: transaction.tenantId },
    });

    let duplicateDetected = false;
    const result = await db.$transaction(async (tx) => {
      const now = new Date();
      let baseDate = now;

      if (pkg) {
        const existingActiveSub = await tx.subscription.findFirst({
          where: { clientId: transaction.clientId, packageId: pkg.id, status: "ACTIVE", expiresAt: { gt: now } },
          orderBy: { expiresAt: "desc" },
        });
        if (existingActiveSub) { baseDate = existingActiveSub.expiresAt; }
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

      const updateResult = await tx.transaction.updateMany({
        where: { id: transaction.id, status: { not: "COMPLETED" } },
        data: { status: "COMPLETED", expiryDate: expiresAt },
      });

      if (updateResult.count === 0) { duplicateDetected = true; return { updatedTx: null, sub: null }; }

      const updatedTx = await tx.transaction.findUnique({ where: { id: transaction.id } });

      if ((transaction as any).invoiceId) {
        await (tx.invoice.update as any)({
          where: { id: (transaction as any).invoiceId },
          data: { status: "PAID", paidAt: now, transactionId: transaction.id },
        });
      }

      let sub = null;
      if (pkg) {
        const existingSub = await tx.subscription.findFirst({
          where: { clientId: transaction.clientId, packageId: pkg.id, status: "ACTIVE" },
        });
        if (existingSub) {
          sub = await tx.subscription.update({
            where: { id: existingSub.id },
            data: { expiresAt, updatedAt: new Date(), syncStatus: "PENDING", onlineStatus: "ONLINE" },
          });
        } else {
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
      }

      await tx.client.update({ where: { id: transaction.clientId }, data: { status: "ACTIVE" } });
      return { updatedTx, sub };
    });

    if (duplicateDetected) {
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "DUPLICATE", processedAt: new Date() },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "COMPLETED", message: "Already processed concurrently" };
    }

    const { sub: newSub } = result;

    // 7. Sync RADIUS
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
          password: client.phone || client.username,
          tenantId: pkg.tenantId || null,
          fullName: client.fullName || undefined,
          expiresAt: (newSub as any).expiresAt,
          status: "Active",
          rateLimit,
          profileName: pkg.name,
        });
      } catch (radErr) {
        logger.error(`[PAYMENT SERVICE] RADIUS sync failed â€” scheduling retry:`, { detail: radErr instanceof Error ? radErr.message : String(radErr) });
        if (newSub?.id) {
          await db.subscription.update({
            where: { id: newSub.id },
            data: { syncStatus: "PENDING_RADIUS_SYNC" },
          }).catch((e) => logger.error("[PAYMENT SERVICE] Failed to mark PENDING_RADIUS_SYNC:", { detail: e instanceof Error ? e.message : String(e) }));
        }
      }
    }

    // 8. MikroTik activation
    if (pkg?.routerId) {
      try {
        const mikrotik = await getMikroTikService(pkg.routerId, pkg.tenantId ?? null);
        const client = transaction.client;
        const pwd = client.phone || "123456";
        const type = client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
        await mikrotik.activateService(client.username, pwd, pkg.name, type, (newSub as any).expiresAt);
        if (newSub?.id) {
          await db.subscription.update({ where: { id: newSub.id }, data: { syncStatus: "SYNCED" } });
        }
        await db.routerLog.create({
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
        logger.error("[PAYMENT SERVICE] MikroTik activation failed:", { error: msg });
        await db.routerLog.create({
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
    await globalDb.webhookLog.update({
      where: { id: webhookLog.id },
      data: { status: "COMPLETED", processedAt: new Date() },
    });

    return { processed: true, transactionRef: parsed.transactionRef, status: "COMPLETED", message: "Payment processed successfully" };
  }

  // â”€â”€ LICENSE Webhook Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  /**
   * Handle a webhook where the transactionRef matches a tenantInvoice.invoiceNumber
   * OR a providerRef. This is the LICENSE payment path.
   *
   * Returns:
   *   WebhookResult  â€” if the ref matched a license invoice
   *   null           â€” if no match (caller handles 404)
   */
  private async processLicenseWebhook(
    parsed: import("@/lib/payments/types").ParsedWebhookPayload,
    webhookLogId: string,
    providerName: string
  ): Promise<WebhookResult | null> {
    const globalDb = getTenantClient(null);

    // Primary lookup: invoiceNumber = our reference sent during initiation
    let invoice = await globalDb.tenantInvoice.findFirst({
      where: { invoiceNumber: parsed.transactionRef },
      include: {
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        tenant: { include: { plan: true } },
      },
    }) as any;

    // FIX-PP-002 FALLBACK: For PalmPesa Endpoint 02, transactionRef = PalmPesa order_id.
    // Try matching via providerRef stored on the invoice.
    if (!invoice && parsed.providerRef && parsed.providerRef !== parsed.transactionRef) {
      invoice = await globalDb.tenantInvoice.findFirst({
        where: { providerRef: parsed.providerRef } as any,
        include: {
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
          tenant: { include: { plan: true } },
        },
      }) as any;
    }

    if (!invoice) {
      return null;
    }

    logger.info("[LICENSE WEBHOOK] Found invoice", { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, tenantId: invoice.tenantId });

    if (invoice.status === "PAID") {
      await globalDb.webhookLog.update({
        where: { id: webhookLogId },
        data: { status: "DUPLICATE", processedAt: new Date(), tenantId: invoice.tenantId },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "COMPLETED", message: "License invoice already paid" };
    }

    const tenantPayment = invoice.payments[0] ?? null;

    if (parsed.resultCode !== "0") {
      if (tenantPayment) {
        await globalDb.tenantPayment.update({
          where: { id: tenantPayment.id },
          data: { status: "FAILED" },
        }).catch((e: any) => logger.error("[LICENSE WEBHOOK] Failed to mark tenantPayment FAILED:", { detail: e instanceof Error ? e.message : String(e) }));
      }
      await globalDb.webhookLog.update({
        where: { id: webhookLogId },
        data: { status: "PROCESSED", processedAt: new Date(), tenantId: invoice.tenantId },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "FAILED", message: parsed.resultMessage ?? "License payment failed" };
    }

    if (parsed.amount !== undefined && parsed.amount < invoice.amount) {
      if (tenantPayment) {
        await globalDb.tenantPayment.update({
          where: { id: tenantPayment.id },
          data: { status: "FAILED" },
        }).catch(() => {});
      }
      await globalDb.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: "FAILED",
          errorMessage: `Underpaid: Paid ${parsed.amount}, Expected ${invoice.amount}`,
          processedAt: new Date(),
          tenantId: invoice.tenantId,
        },
      });
      return { processed: true, transactionRef: parsed.transactionRef, status: "FAILED", message: "Payment amount does not match invoice amount" };
    }

    try {
      const now = new Date();
      const packageMonths: number = invoice.packageMonths ?? 1;

      const tenant = invoice.tenant;
      const currentExpiry = tenant?.licenseExpiresAt
        ? new Date(tenant.licenseExpiresAt)
        : now;
      const baseExpiry = currentExpiry < now ? now : currentExpiry;
      const newExpiry = new Date(baseExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + packageMonths);

      await globalDb.$transaction(async (tx: any) => {
        await tx.tenantInvoice.update({
          where: { id: invoice.id },
          data: { status: "PAID" },
        });

        if (tenantPayment) {
          await tx.tenantPayment.update({
            where: { id: tenantPayment.id },
            data: {
              status: "COMPLETED",
              transactionId: parsed.providerRef ?? tenantPayment.transactionId,
            },
          });
        }

        await tx.tenant.update({
          where: { id: invoice.tenantId },
          data: {
            licenseExpiresAt: newExpiry,
            status: "ACTIVE",
          },
        });
      });

      await globalDb.webhookLog.update({
        where: { id: webhookLogId },
        data: { status: "COMPLETED", processedAt: new Date(), tenantId: invoice.tenantId },
      });

      logger.info("[LICENSE WEBHOOK] License renewed", {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        packageMonths,
        newExpiry,
      });

      return { processed: true, transactionRef: parsed.transactionRef, status: "COMPLETED", message: "License renewed successfully" };
    } catch (err: any) {
      logger.error("[LICENSE WEBHOOK] Error processing license renewal:", { detail: err instanceof Error ? err.message : String(err) });
      await globalDb.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: "FAILED",
          errorMessage: err?.message ?? "License renewal processing error",
          processedAt: new Date(),
          tenantId: invoice.tenantId,
        },
      }).catch(() => {});
      return { processed: false, transactionRef: parsed.transactionRef, message: "License webhook processing error" };
    }
  }
}

export const paymentService = new PaymentService();

