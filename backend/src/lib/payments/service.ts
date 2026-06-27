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
}

// ─── PaymentService ─────────────────────────────────────────────────────────

export class PaymentService {
  /**
   * Load the active PaymentChannel record for a tenant + provider from DB.
   *
   * @param tenantId        null = platform (LICENSE payments), string = tenant (TENANT payments)
   * @param providerName    Provider identifier e.g. "PALMPESA"
   * @param paymentContext  "LICENSE" or "TENANT" — enforces credential isolation.
   *                        Defaults to auto-detecting from tenantId for backwards compatibility.
   *
   * ISOLATION CONTRACT:
   *   LICENSE context → tenantId MUST be null (platform channel)
   *   TENANT context  → tenantId MUST be a non-empty string (tenant channel)
   */
  async getChannel(
    tenantId: string | null,
    providerName: string,
    paymentContext?: PaymentContext
  ) {
    // Auto-detect context from tenantId if not explicitly provided
    const ctx = paymentContext ?? (tenantId === null ? "LICENSE" : "TENANT");

    // CRITICAL-1 FIX: Hard isolation enforcement.
    // If the context and tenantId don't match, reject immediately.
    // This prevents platform credentials from being used for tenant payments
    // and prevents tenant credentials from being used for license payments.
    if (ctx === "LICENSE" && tenantId !== null) {
      throw new Error(
        `[PAYMENT ISOLATION VIOLATION] LICENSE context requires tenantId=null (platform channel), ` +
        `but got tenantId="${tenantId}". ` +
        `Platform credentials must never be used for Hotspot or PPPoE payments.`
      );
    }
    if (ctx === "TENANT" && !tenantId) {
      throw new Error(
        `[PAYMENT ISOLATION VIOLATION] TENANT context requires a non-null tenantId, ` +
        `but got tenantId=null. ` +
        `Tenant credentials must never be used for License payments.`
      );
    }

    // MT-003 FIX: Explicitly match tenantId=null for global channels when tenantId is null.
    const db = getTenantClient(tenantId);
    return db.paymentChannel.findFirst({
      where: {
        provider: providerName.toUpperCase(),
        status: "ACTIVE",
        tenantId: tenantId ?? null,
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

    // PAY-001 FIX: Idempotency check — if a transaction with this reference already
    // exists and is PENDING or COMPLETED, return the existing state without hitting the
    // payment gateway again. Prevents double charges on client retries or network errors.
    const globalDb = getTenantClient(null);
    let db = getTenantClient(tenantId);
    const existingTx = await db.transaction.findFirst({
      where: { reference, tenantId: tenantId ?? null },
    });
    if (existingTx) {
      if (existingTx.status === "COMPLETED") {
        return {
          success: true,
          message: "Payment already completed",
          reference,
          idempotent: true,
        } as any;
      }
      if (existingTx.status === "PENDING") {
        return {
          success: true,
          message: "Payment already initiated and is pending",
          reference,
          idempotent: true,
        } as any;
      }
      // FAILED transactions: allow re-initiation with same reference
    }

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

    const globalDb = getTenantClient(null);
    let db = getTenantClient(tenantId);

    // 2. Log to webhook_logs regardless of verification result
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
      await db.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: verification.reason },
      });
      return { processed: false, message: `Webhook rejected: ${verification.reason}` };
    }

    // 3. Parse payload
    const parsed = provider.parseWebhookPayload(body);

    await db.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        transactionRef: parsed.transactionRef || null,
        providerRef: parsed.providerRef || null,
      },
    });

    if (!parsed.transactionRef) {
      await db.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "FAILED", errorMessage: "Missing transactionRef in payload" },
      });
      return { processed: false, message: "Missing transaction reference in payload" };
    }

    // 4. Idempotency — find existing transaction
    // NOTE: include { client, invoice } — `invoice` is a new relation pending prisma generate
    const transaction = await (db.transaction.findFirst as any)({
      where: {
        reference: parsed.transactionRef,
        ...(tenantId ? { tenantId } : {})
      },
      include: { client: true, invoice: true },
    }) as any;

    if (!tenantId && transaction?.tenantId) {
      db = getTenantClient(transaction.tenantId);
      await globalDb.webhookLog.update({
        where: { id: webhookLog.id },
        data: { tenantId: transaction.tenantId },
      });
    }

    if (!transaction) {
      await db.webhookLog.update({
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
      await db.webhookLog.update({
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
      await db.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" },
        });
      });

      await db.webhookLog.update({
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

    // 5.5. Verify Amount (Prevent Partial Payment Attack)
    if (parsed.amount !== undefined && parsed.amount < transaction.amount) {
      await db.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "FAILED" },
        });
      });

      await db.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          status: "FAILED",
          errorMessage: `Underpaid: Paid ${parsed.amount}, Expected ${transaction.amount}`,
          processedAt: new Date(),
        },
      });

      return {
        processed: true,
        transactionRef: parsed.transactionRef,
        status: "FAILED",
        message: "Payment amount does not match transaction amount",
      };
    }

    // 6. Handle SUCCESSFUL payment
    // E10 FIX: Look up package by packageId stored on Transaction first,
    // fall back to planName (string) only if packageId is absent.
    // This prevents subscription creation failure when a package is renamed.
    const pkg = await db.package.findFirst({
      where: transaction.packageId
        ? { id: transaction.packageId, tenantId: transaction.tenantId }
        : {
          name: transaction.planName ?? "",
          tenantId: transaction.tenantId,
        },
    });



    // DB transaction: mark paid, create/extend subscription, activate client
    let duplicateDetected = false;
    const result = await db.$transaction(async (tx) => {
      const now = new Date();
      let baseDate = now;

      if (pkg) {
        // Fetch existing active sub inside the transaction to prevent race conditions (MB-002)
        const existingActiveSub = await tx.subscription.findFirst({
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
          case "HOURS": expiresAt.setHours(expiresAt.getHours() + pkg.duration); break;
          case "DAYS": expiresAt.setDate(expiresAt.getDate() + pkg.duration); break;
          case "MONTHS": expiresAt.setMonth(expiresAt.getMonth() + pkg.duration); break;
        }
      }

      // Idempotency Lock: Use atomic updateMany to ensure we only update if it's not already COMPLETED
      const updateResult = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { not: "COMPLETED" }
        },
        data: { status: "COMPLETED", expiryDate: expiresAt },
      });

      if (updateResult.count === 0) {
        duplicateDetected = true;
        return { updatedTx: null, sub: null };
      }

      const updatedTx = await tx.transaction.findUnique({
        where: { id: transaction.id }
      });

      // PAY-002 FIX: If this transaction was initiated from an invoice payment,
      // mark the invoice as PAID and record the paidAt timestamp.
      // NOTE: invoiceId, paidAt, transactionId are new schema fields — cast to any until
      // `prisma generate` runs after the migration is applied to the database.
      if ((transaction as any).invoiceId) {
        await (tx.invoice.update as any)({
          where: { id: (transaction as any).invoiceId },
          data: {
            status: "PAID",
            paidAt: now,
            transactionId: transaction.id,
          },
        });
      }

      let sub = null;
      if (pkg) {
        // PAY-005 FIX: If an active subscription already exists for this client + package,
        // EXTEND it instead of creating a new one. Creating new subs on every renewal causes
        // duplicate ACTIVE rows to accumulate, corrupting billing state.
        const existingSub = await tx.subscription.findFirst({
          where: {
            clientId: transaction.clientId,
            packageId: pkg.id,
            status: "ACTIVE",
          },
        });

        if (existingSub) {
          sub = await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              expiresAt,
              updatedAt: new Date(),
              syncStatus: "PENDING",
              onlineStatus: "ONLINE",
            },
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

      await tx.client.update({
        where: { id: transaction.clientId },
        data: { status: "ACTIVE" },
      });

      return { updatedTx, sub };
    });

    if (duplicateDetected) {
      await db.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: "DUPLICATE", processedAt: new Date() },
      });
      return {
        processed: true,
        transactionRef: parsed.transactionRef,
        status: "COMPLETED",
        message: "Already processed concurrently",
      };
    }

    const { sub: newSub } = result;

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
          // RAD-002 FIX: Use client.phone || client.username as RADIUS password fallback.
          // If phone is null, syncRadiusUser throws "Cannot create RadiusUser without a password".
          // Using username as secondary fallback ensures RADIUS sync never fails due to missing phone.
          password: client.phone || client.username,
          tenantId: pkg.tenantId || null,
          fullName: client.fullName || undefined,
          expiresAt: (newSub as any).expiresAt,
          status: "Active",
          rateLimit,
          profileName: pkg.name,
        });
      } catch (radErr) {
        // E09 FIX: RADIUS sync failed — mark subscription for retry instead of
        // silently swallowing the error. A background job can retry PENDING_RADIUS_SYNC.
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
          await db.subscription.update({
            where: { id: newSub.id },
            data: { syncStatus: "SYNCED" },
          });
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
    await db.webhookLog.update({
      where: { id: webhookLog.id },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    return {
      processed: true,
      transactionRef: parsed.transactionRef,
      status: "COMPLETED",
      message: "Payment processed successfully",
    };
  }
}

export const paymentService = new PaymentService();

