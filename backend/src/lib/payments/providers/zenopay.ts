/**
 * ZenoPay Payment Provider
 *
 * Official API docs (official GitHub): https://github.com/ZenoPay/zenopay-php
 * Dashboard / API base: https://zenoapi.com/api/payments
 *
 * Auth: x-api-key header
 *
 * CONFIRMED ENDPOINTS:
 *   [1] Initiate:
 *     POST https://zenoapi.com/api/payments/mobile_money_tanzania
 *     Headers: { x-api-key }
 *     Body: { order_id, buyer_email, buyer_name, buyer_phone, amount, webhook_url? }
 *     Success response: { status: "success", resultcode: "000", message, order_id }
 *
 *   [2] Check Status:
 *     GET https://zenoapi.com/api/payments/order-status?order_id={order_id}
 *     Headers: { x-api-key }
 *     Response: { data: [{ order_id, payment_status, amount, reference }] , result, message }
 *
 *   [3] Webhook callback (POST to webhook_url):
 *     { order_id, payment_status, reference, metadata }
 *     payment_status values: "COMPLETED" | "FAILED"
 *     Webhook verification: check x-api-key header equals our API key
 *
 * FIX-ZP-001 (2026-06-30):
 *   Status endpoint was GET /payments/status/{order_id} — not documented.
 *   Official docs show GET /payments/order-status?order_id={order_id}.
 *   Fixed the checkStatus() method accordingly.
 */

import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  TransactionStatus,
  WebhookVerification,
  ParsedWebhookPayload,
  ProviderConfig,
} from "@/lib/payments/types";
import {
  formatPhoneLocal,
  timingSafeEqual,
  computeHmac,
  httpPost,
  httpGet,
  retryWithBackoff,
} from "@/lib/payments/utils";

export class ZenoPayProvider implements PaymentProvider {
  readonly name = "ZENOPAY" as const;

  private apiKey: string;
  private accountId: string;
  private apiUrl: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("ZenoPay: apiKey is required");
    this.apiKey = config.apiKey;
    this.accountId = config.accountId ?? "";
    const url = config.apiUrl ?? process.env.ZENOPAY_API_URL ?? "https://zenoapi.com/api/payments";
    this.apiUrl = url.replace(/\/$/, "");
    this.webhookSecret = config.webhookSecret ?? "";
    this.environment = process.env.NODE_ENV === "production" ? "live" : (config.environment ?? "sandbox");
  }

  // Auth: x-api-key header (per official docs)
  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  // ── Initiate Payment ──────────────────────────────────────────────────────
  // POST /mobile_money_tanzania
  // buyer_phone: local TZ format per docs example (0744963858)

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    // Docs show local format: 0744963858
    const phone = formatPhoneLocal(request.phone);

    const payload: Record<string, unknown> = {
      order_id:    request.reference,
      amount:      Math.round(request.amount),
      buyer_name:  request.buyerName  ?? "Customer",
      buyer_phone: phone,
      buyer_email: request.buyerEmail ?? "",
      webhook_url: request.callbackUrl,
    };

    if (this.accountId) {
      payload.account_id = this.accountId;
    }

    try {
      const result = await retryWithBackoff(
        () => httpPost(`${this.apiUrl}/mobile_money_tanzania`, payload, this.headers),
        2
      );

      const data = result.data as Record<string, unknown>;

      // Docs success: { status: "success", resultcode: "000", order_id }
      if (result.ok && (data?.status === "success" || data?.success === true)) {
        return {
          success: true,
          providerRef:
            (data?.order_id      as string) ??
            (data?.transaction_id as string) ??
            request.reference,
          message:     (data?.message as string) ?? "Payment initiated",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.message as string) ??
          (data?.error   as string) ??
          `ZenoPay error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `ZenoPay error: ${msg}` };
    }
  }

  // ── Check Transaction Status ──────────────────────────────────────────────
  // FIX-ZP-001: Official endpoint is GET /order-status?order_id={order_id}
  //   (NOT /status/{order_id} which was the previous incorrect implementation)
  // Response: { data: [{ order_id, payment_status, amount, reference }], result, message }

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    try {
      const url = `${this.apiUrl}/order-status?order_id=${encodeURIComponent(providerRef)}`;
      const result = await httpGet(url, this.headers);

      const data = result.data as Record<string, unknown>;

      // Status is inside data[0].payment_status per official docs
      const inner = Array.isArray(data?.data) ? (data.data as any[])[0] ?? {} : {};
      const rawStatus = (
        (inner?.payment_status ?? data?.payment_status ?? data?.status ?? "") as string
      ).toUpperCase();

      let status: TransactionStatus["status"] = "PENDING";
      if (rawStatus === "COMPLETED" || rawStatus === "SUCCESS" || rawStatus === "PAID") {
        status = "COMPLETED";
      } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED" || rawStatus === "REJECTED") {
        status = "FAILED";
      } else if (rawStatus === "EXPIRED") {
        status = "EXPIRED";
      }

      return {
        status,
        providerRef: (inner?.order_id as string) ?? providerRef,
        amount:      inner?.amount ? Number(inner.amount) : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[ZENOPAY] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────────────
  // Official docs (webhook.php): check x-api-key header equals our API key
  // We also support HMAC via x-zeno-signature for additional security.

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret && !this.apiKey) {
      console.error("[ZENOPAY] Neither webhookSecret nor apiKey configured — rejecting webhook.");
      return { verified: false, reason: "Webhook secret not configured" };
    }

    // Optional HMAC signature
    const hmacHeader = headers["x-zeno-signature"] as string | undefined;
    if (hmacHeader && this.webhookSecret) {
      const expected = computeHmac(this.webhookSecret, rawBody);
      const valid = timingSafeEqual(hmacHeader, expected);
      return { verified: valid, reason: valid ? undefined : "HMAC mismatch" };
    }

    // Official docs: verify x-api-key header equals our API key
    const apiKeyHeader = headers["x-api-key"] as string | undefined;
    if (apiKeyHeader) {
      const valid = timingSafeEqual(apiKeyHeader, this.apiKey);
      return { verified: valid, reason: valid ? undefined : "API key mismatch" };
    }

    // Fallback: shared webhook secret in x-webhook-secret
    const secretHeader = headers["x-webhook-secret"] as string | undefined;
    if (secretHeader && this.webhookSecret) {
      const valid = timingSafeEqual(secretHeader, this.webhookSecret);
      return { verified: valid, reason: valid ? undefined : "Secret mismatch" };
    }

    return { verified: false, reason: "Missing signature header (x-api-key or x-zeno-signature)" };
  }

  // ── Parse Webhook Payload ─────────────────────────────────────────────────
  // Official webhook payload: { order_id, payment_status, reference, metadata }
  // payment_status: "COMPLETED" | "FAILED"

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b = body as Record<string, unknown>;

    // Docs: payment_status is the status field
    const rawStatus = (
      (b?.payment_status ?? b?.status ?? "") as string
    ).toUpperCase();

    const resultCode =
      rawStatus === "COMPLETED" || rawStatus === "SUCCESS" || rawStatus === "PAID"
        ? "0"
        : "1";

    return {
      // order_id is our reference sent during initiation
      transactionRef:
        (b?.order_id   as string | undefined) ??
        (b?.reference  as string | undefined) ??
        "",
      providerRef:
        (b?.order_id       as string | undefined) ??
        (b?.transaction_id as string | undefined) ??
        undefined,
      resultCode,
      resultMessage: rawStatus,
      amount:        b?.amount ? Number(b.amount) : undefined,
      phone:         (b?.buyer_phone as string | undefined) ?? undefined,
      rawBody:       body,
    };
  }
}
