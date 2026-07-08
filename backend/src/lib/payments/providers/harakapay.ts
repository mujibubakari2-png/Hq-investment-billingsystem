/**
 * HarakaPay Payment Provider
 *
 * HarakaPay payment gateway for East Africa mobile money collections.
 * Portal: https://harakapay.net  |  Docs: https://harakapay.net/api/docs
 *
 * CONFIRMED ENDPOINTS (official docs @ https://harakapay.net/api/docs):
 *
 *   Authentication:
 *     Header: X-API-Key: hpk_your_api_key_here
 *
 *   [1] Collect payment (USSD push)
 *     POST https://harakapay.net/api/v1/collect
 *     Body: { phone, amount, description?, webhook_url? }
 *     Response: { success, message, order_id, amount, net_amount, fee }
 *
 *   [2] Check status
 *     GET https://harakapay.net/api/v1/status/{order_id}
 *     Response: { success, payment: { order_id, status, amount, ... } }
 *
 *   [3] Webhook callback (POST to webhook_url)
 *     { order_id, status, amount, net_amount, fee_amount, created_at, completed_at }
 *     status values: "completed" | "failed"
 *
 * FIX-HP-001 (2026-06-29):
 *   Previous implementation hit /payments/collect with fields reference, currency,
 *   msisdn, msisdn_local, customer_name, customer_email, narration, callback_url,
 *   environment â€” NONE of which match the official docs.
 *   Corrected to /api/v1/collect with only: phone, amount, description, webhook_url.
 *   Auth header changed from X-Api-Key / X-Api-Secret to single X-API-Key per docs.
 *   Status endpoint corrected from /payments/status/{id} to /api/v1/status/{id}.
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
import logger from "@/lib/logger";
import {
  formatPhoneLocal,
  timingSafeEqual,
  computeHmac,
  httpPost,
  httpGet,
  retryWithBackoff,
} from "@/lib/payments/utils";

export class HarakaPayProvider implements PaymentProvider {
  readonly name = "HARAKAPAY" as const;

  private apiKey: string;
  private apiUrl: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("HarakaPay: apiKey is required");
    this.apiKey = config.apiKey;

    // FIX-HP-001: Official base URL is https://harakapay.net
    const url = config.apiUrl ?? process.env.HARAKAPAY_API_URL ?? "https://harakapay.net";
    this.apiUrl = url.replace(/\/$/, "");

    this.webhookSecret = config.webhookSecret ?? "";
    this.environment = process.env.NODE_ENV === "production" ? "live" : (config.environment ?? "sandbox");
  }

  // FIX-HP-001: Official auth header is X-API-Key only (no X-Api-Secret)
  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
    };
  }

  // â”€â”€â”€ Initiate Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FIX-HP-001: Official endpoint is POST /api/v1/collect
  //             Required fields: phone, amount
  //             Optional: description, webhook_url

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    // FIX-HP-001: HarakaPay docs show local format (07XXXXXXXX)
    const phone = formatPhoneLocal(request.phone);

    const payload: Record<string, unknown> = {
      phone:       phone,
      amount:      Math.round(request.amount),
      description: request.description ?? `Payment ${request.reference}`,
      webhook_url: request.callbackUrl,
    };

    try {
      const result = await retryWithBackoff(
        // FIX-HP-001: Correct endpoint
        () => httpPost(`${this.apiUrl}/api/v1/collect`, payload, this.headers),
        2
      );

      const data = result.data as Record<string, unknown>;

      // Docs: success response has { success: true, order_id, amount, ... }
      if (result.ok && data?.success === true) {
        return {
          success: true,
          providerRef: (data?.order_id as string) ?? request.reference,
          message:     (data?.message  as string) ?? "Payment initiated",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.error   as string) ??
          (data?.message as string) ??
          `HarakaPay error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `HarakaPay error: ${msg}` };
    }
  }

  // â”€â”€â”€ Check Transaction Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FIX-HP-001: Official endpoint is GET /api/v1/status/{order_id}
  //             Response has payment.status = "completed" | "failed" | "pending"

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    try {
      const result = await httpGet(
        `${this.apiUrl}/api/v1/status/${providerRef}`,
        this.headers
      );

      const data = result.data as Record<string, unknown>;
      // Status is nested inside payment object per docs
      const payment   = (data?.payment as Record<string, unknown>) ?? {};
      const rawStatus = ((payment?.status ?? data?.status ?? "") as string).toLowerCase();

      let status: TransactionStatus["status"] = "PENDING";
      if (rawStatus === "completed") {
        status = "COMPLETED";
      } else if (rawStatus === "failed") {
        status = "FAILED";
      } else if (rawStatus === "expired") {
        status = "EXPIRED";
      }

      return {
        status,
        providerRef: (payment?.order_id as string) ?? providerRef,
        amount:      payment?.amount ? Number(payment.amount) : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logger.error(`[HARAKAPAY] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // â”€â”€â”€ Webhook Verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // HarakaPay docs do not document a signature scheme; we accept HMAC or shared secret.

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      logger.error("[HARAKAPAY] Webhook secret not configured â€” rejecting webhook.");
      return { verified: false, reason: "Webhook secret not configured" };
    }

    const hmacSig =
      (headers["x-haraka-signature"]  as string | undefined) ??
      (headers["x-webhook-signature"] as string | undefined);

    if (hmacSig) {
      const expected = computeHmac(this.webhookSecret, rawBody);
      const valid    = timingSafeEqual(hmacSig, expected);
      return { verified: valid, reason: valid ? undefined : "HMAC mismatch" };
    }

    const secretHeader =
      (headers["x-webhook-secret"] as string | undefined) ??
      (headers["x-haraka-secret"]  as string | undefined) ??
      (headers["x-api-key"]        as string | undefined);

    if (secretHeader) {
      const valid = timingSafeEqual(secretHeader, this.webhookSecret);
      return { verified: valid, reason: valid ? undefined : "Secret mismatch" };
    }

    return { verified: false, reason: "No signature header found" };
  }

  // â”€â”€â”€ Parse Webhook Payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Official webhook payload: { order_id, status, amount, net_amount, fee_amount,
  //                             created_at, completed_at }
  // status: "completed" | "failed"

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b = body as Record<string, unknown>;

    // FIX-HP-001: Official status values are lowercase "completed" / "failed"
    const rawStatus = (
      (b?.status              ?? "") as string
    ).toLowerCase();

    const isSuccess  = rawStatus === "completed";
    const resultCode = isSuccess ? "0" : "1";

    return {
      transactionRef:
        (b?.order_id           as string | undefined) ??
        (b?.reference          as string | undefined) ??
        (b?.account_reference  as string | undefined) ??
        (b?.AccountReference   as string | undefined) ??
        "",
      providerRef:
        (b?.order_id           as string | undefined) ??
        (b?.transaction_id     as string | undefined) ??
        (b?.TransactionId      as string | undefined) ??
        undefined,
      resultCode,
      resultMessage: rawStatus,
      amount: b?.amount ? Number(b.amount) : undefined,
      phone:  undefined,   // not included in HarakaPay webhook payload
      rawBody: body,
    };
  }
}
