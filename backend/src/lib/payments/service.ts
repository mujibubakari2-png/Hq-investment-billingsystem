/**
 * Central Payment Service Orchestrator
 *
 * Single entry point for all payment operations across providers.
 * Handles: initiation, status checks, webhook processing, logging, idempotency.
 */

import { getTenantClient } from "@/lib/tenantPrisma";
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

/**
 * PAYMENT ARCHITECTURE — CREDENTIAL ISOLATION CONTRACT
 * =====================================================
 * This system operates two completely separate payment contexts:
 *
 * LICENSE context  (paymentContext = "LICENSE"):
 *   - Used for: License Purchase, License Renewal, SaaS Subscription Payments.
 *   - Credentials: Platform Super Admin's PaymentChannel (tenantId = null).
 *   - Money flows to: Platform Owner only.
 *   - Route: POST /api/license/renew → this service with tenantId = null.
 *
 * TENANT context   (paymentContext = "TENANT"):
 *   - Used for: Hotspot customer payments, PPPoE customer payments.
 *   - Credentials: Tenant Super Admin's PaymentChannel (tenantId = <value>).
 *   - Money flows to: That specific tenant only.
 *   - Route: POST /api/payments/initiate → this service with tenantId = <value>.
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

// ─── PaymentService ─────────────────────────────────────────────────────────

export class PaymentService {
  /**
   * Load the active PaymentChannel record for a tenant + provider from DB.
   */
  async getChannel(
    tenantId: string | null,
    providerName: string,
    paymentContext?: PaymentContext
  ) {
    console.log("[TRACE][PaymentService.getChannel] ENTER", { tenantId, providerName, paymentContext });
    const ctx = paymentContext ?? (tenantId === null ? "LICENSE" : "TENANT");

    if (ctx === "LICENSE" && tenantId !== null) {
      console.error("[TRACE][PaymentService.getChannel] EARLY_RETURN", { reason: "LICENSE context requires tenantId=null" });
      throw new Error(
        `[PAYMENT ISOLATION VIOLATION] LICENSE context requires tenantId=null (platform channel), ` +
        `but got tenantId="${tenantId}". ` +
        `Platform credentials must never be used for Hotspot or PPPoE payments.`
      );
    }
    if (ctx === "TENANT" && !tenantId) {
      console.error("[TRACE][PaymentService.getChannel] EARLY_RETURN", { reason: "TENANT context requires a tenantId" });
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

    console.log("[TRACE][PaymentService.getChannel] EXIT", { tenantId, providerName, channel });
    return channel;
  }

  // ── Initiate Payment ────────────────────────────────────────────────────

  async initiatePayment(opts: InitiatePaymentOptions): Promise<PaymentResponse & { reference: string }> {
    console.log("[TRACE][PaymentService.initiatePayment] ENTER", { opts });
    const { tenantId, amount, phone, providerName, description, buyerName, buyerEmail, paymentContext } = opts;

    if (!isSupportedProvider(providerName)) {
      console.error("[TRACE][PaymentService.initiatePayment] EARLY_RETURN", { reason: "unsupported provider", providerName });
      return { success: false, message: `Unsupported provider: ${providerName}`, reference: opts.reference ?? "" };
    }
    if (!isValidAmount(amount)) {
      console.error("[TRACE][PaymentService.initiatePayment] EARLY_RETURN", { reason: "invalid amount", amount });
      return { success: false, message: `Invalid amount: ${amount}. Must be between 100 and 10,000,000 TZS.`, reference: opts.reference ?? "" };
    }

    const reference = opts.reference ?? generateReference(providerName.slice(0, 2));
    const cleanPhone = formatPhoneTZ(phone);
    const callbackUrl = opts.callbackUrl ?? buildCallbackUrl(providerName);
    console.log("[TRACE][PaymentService.initiatePayment] CALLBACK", { providerName, callbackUrl, phone: cleanPhone });

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
      console.warn("[TRACE][PaymentService.initiatePayment] IDENTITY_CHECK_FAILED", { reference, code, message });
      if (code === "P2021" || /table .*transactions.* does not exist/i.test(message)) {
        console.warn("[TRACE][PaymentService.initiatePayment] CONTINUING_WITHOUT_IDENTITY_CHECK", { reference });
      } else {
        throw error;
      }
    }
    if (existingTx) {
      console.log("[TRACE][PaymentService.initiatePayment] EXISTING_TRANSACTION", { reference, status: existingTx.status });
      if (existingTx.status === "COMPLETED") {
        return { success: true, message: "Payment already completed", reference, idempotent: true } as any;
      }
      if (existingTx.status === "PENDING") {
        return { success: true, message: "Payment already initiated and is pending", reference, idempotent: true } as any;
      }
    }

    const channel = await this.getChannel(tenantId, providerName, paymentContext);
    const provider = getPaymentProvider(providerName, channel);
    console.log("[TRACE][PaymentService.initiatePayment] PROVIDER_SELECTED", { providerName, providerClass: provider.constructor?.name, channel });

    const request: PaymentRequest = { amount, phone: cleanPhone, reference, description, callbackUrl, buyerName, buyerEmail };

    console.log("[TRACE][PaymentService.initiatePayment] CALLING_PROVIDER", { providerName, request });
    const response = await provider.initiatePayment(request);
    console.log("[TRACE][PaymentService.initiatePayment] EXIT", { providerName, response, reference });
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
    tenantId: string | null = null,
    options?: { skipLicense?: boolean; skipTenant?: boolean }
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

    const globalDb = getTenantClient(null);
    let db = getTenantClient(tenantId);

    // 2. Log to webhook_logs
    const webhookLog = await globalDb.webhookLog.create({
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
      transaction = await (db.transaction.findFirst as any)({
        where: {
          reference: parsed.transactionRef,
          ...(tenantId ? { tenantId } : {}),
        },
        include: { client: true, invoice: true },
      }) as any;

      // Fallback: lookup by providerRef (for providers that only echo their own order_id)
      if (!transaction && parsed.providerRef && parsed.providerRef !== parsed.transactionRef) {
        transaction = await (db.transaction.findFirst as any)({
          where: {
            providerRef: parsed.providerRef,
            ...(tenantId ? { tenantId } : {}),
          },
          include: { client: true, invoice: true },
        }) as any;

        if (transaction) {
          console.log("[PAYMENT SERVICE] Resolved transaction via providerRef fallback", {
            transactionRef: parsed.transactionRef,
            providerRef: parsed.providerRef,
            transactionId: transaction.id,
          });
        }
      }
    }

    if (!tenantId && transaction?.tenantId) {
      db = getTenantClient(transaction.tenantId);
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { tenantId: transaction.tenantId },
      });
    }

    // ── LICENSE PAYMENT FALLBACK ──────────────────────────────────────────────
    // If no hotspot/PPPoE transaction found, check if this is a LICENSE payment.
    if (!transaction) {
      if (options?.skipLicense) {
        console.error(`[PAYMENT SERVICE] Transaction not found and skipLicense is true. Reference: ${parsed.transactionRef}`);
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

      // Not a license payment either — genuine 404
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

    // Already processed — return early
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
        console.error(`[PAYMENT SERVICE] RADIUS sync failed — scheduling retry:`, radErr);
        if (newSub?.id) {
          await db.subscription.update({
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
        console.error(`[PAYMENT SERVICE] MikroTik activation failed:`, msg);
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

  // ── LICENSE Webhook Handler ───────────────────────────────────────────────
  /**
   * Handle a webhook where the transactionRef matches a tenantInvoice.invoiceNumber
   * OR a providerRef. This is the LICENSE payment path.
   *
   * Returns:
   *   WebhookResult  — if the ref matched a license invoice
   *   null           — if no match (caller handles 404)
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

    console.log("[LICENSE WEBHOOK] Found invoice", { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, tenantId: invoice.tenantId });

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
        }).catch((e: any) => console.error("[LICENSE WEBHOOK] Failed to mark tenantPayment FAILED:", e));
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

      console.log("[LICENSE WEBHOOK] License renewed", {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        packageMonths,
        newExpiry,
      });

      return { processed: true, transactionRef: parsed.transactionRef, status: "COMPLETED", message: "License renewed successfully" };
    } catch (err: any) {
      console.error("[LICENSE WEBHOOK] Error processing license renewal:", err);
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
