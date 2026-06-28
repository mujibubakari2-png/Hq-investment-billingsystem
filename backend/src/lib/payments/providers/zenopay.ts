/**
 * ZenoPay Payment Provider
 *
 * Confirmed API docs (official):
 * - Auth: x-api-key header
 * - Initiate: POST https://zenoapi.com/api/payments/mobile_money_tanzania
 * - Status:   GET  https://zenoapi.com/api/payments/status/{order_id}
 * - Webhook:  POST to your webhook_url with { order_id, status, ... }
 *
 * Credentials: email support@zenopay.net for API key, account_id
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
    const url = config.apiUrl ?? process.env.ZENOPAY_API_URL;
    if (!url) {
      throw new Error("ZenoPay: API URL is not configured. Set ZENOPAY_API_URL in environment variables or channel config.");
    }
    this.apiUrl = url.replace(/\/$/, ""); // strip trailing slash
    this.webhookSecret = config.webhookSecret ?? "";
    this.environment = process.env.NODE_ENV === "production" ? "live" : (config.environment ?? "sandbox");
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  // ── Initiate Payment ──────────────────────────────────────────────────────

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    // ZenoPay expects local format: 07XXXXXXXX
    const phone = formatPhoneLocal(request.phone);

    const payload: Record<string, unknown> = {
      order_id: request.reference,
      amount: Math.round(request.amount),
      currency: "TZS",
      buyer_name: request.buyerName ?? "Customer",
      buyer_phone: phone,
      buyer_email: request.buyerEmail ?? "",
      webhook_url: request.callbackUrl,
    };

    if (this.accountId) {
      payload.account_id = this.accountId;
    }

    try {
      const result = await retryWithBackoff(
        () => httpPost(`${this.apiUrl}/payments/mobile_money_tanzania`, payload, this.headers),
        2
      );

      const data = result.data as Record<string, unknown>;

      if (result.ok && (data?.status === "success" || data?.success === true)) {
        return {
          success: true,
          providerRef:
            (data?.order_id as string) ??
            (data?.transaction_id as string) ??
            request.reference,
          message: (data?.message as string) ?? "Payment initiated",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.message as string) ??
          (data?.error as string) ??
          `ZenoPay error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `ZenoPay error: ${msg}` };
    }
  }

  // ── Check Transaction Status ──────────────────────────────────────────────

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    try {
      const result = await httpGet(
        `${this.apiUrl}/payments/status/${providerRef}`,
        this.headers
      );

      const data = result.data as Record<string, unknown>;
      const rawStatus = ((data?.status ?? data?.payment_status ?? "") as string).toUpperCase();

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
        providerRef: (data?.order_id as string) ?? providerRef,
        amount: data?.amount ? Number(data.amount) : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[ZENOPAY] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────────────

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      console.error("[ZENOPAY] Webhook secret not configured — rejecting webhook. Set webhookSecret on the PaymentChannel record.");
      return { verified: false, reason: "Webhook secret not configured" };
    }

    const hmacHeader = headers["x-zeno-signature"] as string | undefined;
    const apiKeyHeader = headers["x-api-key"] as string | undefined;

    if (hmacHeader) {
      const expected = computeHmac(this.webhookSecret, rawBody);
      const valid = timingSafeEqual(hmacHeader, expected);
      return { verified: valid, reason: valid ? undefined : "HMAC mismatch" };
    }

    if (apiKeyHeader) {
      const valid = timingSafeEqual(apiKeyHeader, this.apiKey);
      return { verified: valid, reason: valid ? undefined : "API key mismatch" };
    }

    return { verified: false, reason: "Missing signature header" };
  }

  // ── Parse Webhook Payload ─────────────────────────────────────────────────

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b = body as Record<string, unknown>;

    const rawStatus = ((b?.status ?? b?.payment_status ?? "") as string).toUpperCase();
    const resultCode =
      rawStatus === "COMPLETED" || rawStatus === "SUCCESS" || rawStatus === "PAID"
        ? "0"
        : "1";

    return {
      transactionRef:
        (b?.order_id as string) ??
        (b?.reference as string) ??
        (b?.tx_ref as string) ??
        "",
      providerRef:
        (b?.transaction_id as string) ??
        (b?.provider_ref as string) ??
        undefined,
      resultCode,
      resultMessage: (b?.message as string) ?? rawStatus,
      amount: b?.amount ? Number(b.amount) : undefined,
      phone: (b?.buyer_phone as string) ?? (b?.phone as string) ?? undefined,
      rawBody: body,
    };
  }
}
