/**
 * Mongike Payment Provider
 *
 * Mongike aggregates TZ mobile money (M-Pesa, Airtel Money, Halo Pesa, Tigo Pesa).
 * Docs: https://mongike.docs.buildwithfern.com/
 *
 * Auth: x-api-key header (required on every request)
 *
 * CONFIRMED ENDPOINTS (official OpenAPI spec + webhook docs):
 *
 *   [1] Initiate Mobile Money Payment
 *     POST https://mongike.com/api/v1/payments/mobile-money/tanzania
 *     Headers: { x-api-key }
 *     Body (required): { order_id, amount, buyer_phone, fee_payer }
 *     Body (optional): { buyer_name, buyer_email, metadata, webhook_url }
 *     buyer_phone: international format, no + (e.g. "255712345678")
 *     fee_payer: "MERCHANT" | "CUSTOMER"
 *     Response 201: { status: "success", message, data: { id, order_id, gateway_ref, amount, status, expires_at } }
 *
 *   [2] Get Payment Status
 *     No dedicated status-check endpoint is documented. Use webhook for status updates.
 *     (If Mongike provides one privately, add the URL to channel.config.apiStatusUrl)
 *
 *   [3] Webhook callback (POST to webhook_url supplied at initiation)
 *     Headers: { x-api-key: YOUR_API_KEY }
 *     Payload: { order_id, payment_status, reference, amount, metadata }
 *     payment_status: "COMPLETED" (only COMPLETED triggers the webhook per docs)
 *     Verification: check x-api-key header equals our API key
 *
 * FIX-MG-001 (2026-06-30):
 *   Previous implementation used wrong base URL (api.mongike.com/v1),
 *   wrong initiate endpoint (/payments/initiate), wrong payload fields
 *   (reference, phone_number, phone_local, customer_name, description, callback_url,
 *   currency, environment — NONE documented), wrong auth (x-api-secret + x-environment),
 *   and wrong webhook verification (HMAC). All corrected to match official OpenAPI spec.
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
  formatPhoneTZ,
  timingSafeEqual,
  httpPost,
  retryWithBackoff,
} from "@/lib/payments/utils";

export class MongikeProvider implements PaymentProvider {
  readonly name = "MONGIKE" as const;

  private apiKey: string;
  private apiUrl: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("Mongike: apiKey is required");
    this.apiKey = config.apiKey;

    // FIX-MG-001: Official base URL is https://mongike.com/api/v1
    const url = config.apiUrl ?? process.env.MONGIKE_API_URL ?? "https://mongike.com/api/v1";
    this.apiUrl = url.replace(/\/$/, "");

    // webhookSecret falls back to apiKey since Mongike sends x-api-key for webhook auth
    this.webhookSecret = config.webhookSecret ?? "";
    this.environment = process.env.NODE_ENV === "production" ? "live" : (config.environment ?? "sandbox");
  }

  // FIX-MG-001: Only x-api-key; no x-api-secret or x-environment headers per docs
  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  // ── Initiate Payment ──────────────────────────────────────────────────────
  // FIX-MG-001: Official endpoint POST /payments/mobile-money/tanzania
  // Required: order_id, amount, buyer_phone, fee_payer
  // Optional: buyer_name, buyer_email, metadata, webhook_url

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    // International format, no + sign: 255712345678
    const phone = formatPhoneTZ(request.phone); // returns 255XXXXXXXXX — correct format

    const payload: Record<string, unknown> = {
      order_id:    request.reference,
      amount:      Math.round(request.amount),
      buyer_phone: phone,
      fee_payer:   "MERCHANT",    // platform absorbs the fee by default
      webhook_url: request.callbackUrl,
    };

    // Optional fields — only include when provided
    if (request.buyerName)  payload.buyer_name  = request.buyerName;
    if (request.buyerEmail) payload.buyer_email = request.buyerEmail;

    try {
      const result = await retryWithBackoff(
        () => httpPost(
          `${this.apiUrl}/payments/mobile-money/tanzania`,
          payload,
          this.headers
        ),
        2
      );

      const data = result.data as Record<string, unknown>;
      // Docs: 201 Created on success
      // Response: { status: "success", message, data: { id, order_id, gateway_ref, amount, status } }
      const inner = (data?.data as Record<string, unknown>) ?? {};

      if ((result.status === 201 || result.ok) && data?.status === "success") {
        return {
          success:     true,
          // gateway_ref is Mongike's internal payment reference
          providerRef: (inner?.gateway_ref as string) ?? (inner?.id as string) ?? request.reference,
          message:     (data?.message    as string) ?? "Payment initiated successfully",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.message as string) ??
          (data?.code    as string) ??
          `Mongike error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `Mongike error: ${msg}` };
    }
  }

  // ── Check Transaction Status ──────────────────────────────────────────────
  // Mongike official docs do NOT document a status-check endpoint.
  // Return PENDING always; rely on webhook for authoritative status.
  // If a private status URL is configured in channel.config.apiStatusUrl, use it.

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    console.warn(
      "[MONGIKE] checkStatus called but Mongike does not document a status-check endpoint. " +
      "Returning PENDING. Rely on webhooks for authoritative status updates."
    );
    return { status: "PENDING", providerRef };
  }

  // ── Webhook Verification ──────────────────────────────────────────────────
  // FIX-MG-001: Official docs state Mongike sends x-api-key header for webhook auth.
  // "Mongike will send the x-api-key in the request header when calling your webhook URL."

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    _rawBody: string
  ): Promise<WebhookVerification> {
    // Primary: verify x-api-key matches our API key (per official docs)
    const incomingApiKey =
      (headers["x-api-key"] as string | undefined) ?? "";

    if (!incomingApiKey) {
      return { verified: false, reason: "Missing x-api-key header" };
    }

    // Compare against apiKey (the key Mongike sends back to us)
    if (timingSafeEqual(incomingApiKey, this.apiKey)) {
      return { verified: true };
    }

    // Fallback: compare against webhookSecret if separately configured
    if (this.webhookSecret && timingSafeEqual(incomingApiKey, this.webhookSecret)) {
      return { verified: true };
    }

    return { verified: false, reason: "x-api-key mismatch" };
  }

  // ── Parse Webhook Payload ─────────────────────────────────────────────────
  // Official webhook payload:
  //   { order_id, payment_status, reference, amount, metadata }
  // payment_status: "COMPLETED" (only value per docs — webhook only fires on COMPLETED)

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b = body as Record<string, unknown>;

    // payment_status from Mongike webhook is "COMPLETED"
    const rawStatus = (
      (b?.payment_status ?? b?.status ?? "") as string
    ).toUpperCase();

    const isSuccess  = rawStatus === "COMPLETED" || rawStatus === "SUCCESS";
    const resultCode = isSuccess ? "0" : "1";

    return {
      // order_id = our reference (order_id we sent during initiation)
      transactionRef:
        (b?.order_id   as string | undefined) ??
        (b?.reference  as string | undefined) ??
        "",
      // reference = Mongike's gateway reference
      providerRef:
        (b?.reference  as string | undefined) ??
        (b?.order_id   as string | undefined) ??
        undefined,
      resultCode,
      resultMessage: rawStatus,
      // Amount is included in Mongike webhook payload
      amount:  b?.amount != null ? Number(b.amount) : undefined,
      phone:   undefined,  // not included in Mongike webhook payload
      rawBody: body,
    };
  }
}
