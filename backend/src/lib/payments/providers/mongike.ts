/**
 * Mongike Payment Provider
 *
 * Mongike aggregates TZ mobile money (M-Pesa, Airtel Money, Halo Pesa, Tigo Pesa).
 * Register at: https://mongike.com/
 *
 * Auth: API Key in header (x-api-key) + optional HMAC webhook signature
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
  formatPhoneLocal,
  timingSafeEqual,
  computeHmac,
  httpPost,
  httpGet,
  retryWithBackoff,
} from "@/lib/payments/utils";

export class MongikeProvider implements PaymentProvider {
  readonly name = "MONGIKE" as const;

  private apiKey: string;
  private apiSecret: string;
  private apiUrl: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("Mongike: apiKey is required");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret ?? "";
    const url = config.apiUrl ?? process.env.MONGIKE_API_URL;
    if (!url) {
      throw new Error("Mongike: API URL is not configured. Set MONGIKE_API_URL in environment variables or channel config.");
    }
    this.apiUrl = url.replace(/\/$/, ""); // strip trailing slash
    this.webhookSecret = config.webhookSecret ?? "";
    this.environment = process.env.NODE_ENV === "production" ? "live" : (config.environment ?? "sandbox");
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "x-api-secret": this.apiSecret,
      "x-environment": this.environment,
    };
  }

  // ── Initiate Payment ──────────────────────────────────────────────────────

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const phone = formatPhoneTZ(request.phone);

    const payload: Record<string, unknown> = {
      reference: request.reference,
      amount: Math.round(request.amount),
      currency: "TZS",
      phone_number: phone,
      phone_local: formatPhoneLocal(request.phone),
      customer_name: request.buyerName ?? "Customer",
      customer_email: request.buyerEmail ?? "",
      description: request.description ?? `Payment ${request.reference}`,
      callback_url: request.callbackUrl,
      environment: this.environment,
    };

    try {
      const result = await retryWithBackoff(
        () => httpPost(`${this.apiUrl}/payments/initiate`, payload, this.headers),
        2
      );

      const data = result.data as Record<string, unknown>;

      if (
        result.ok &&
        (data?.success === true ||
          data?.status === "success" ||
          data?.code === "0" ||
          data?.code === 0)
      ) {
        return {
          success: true,
          providerRef:
            (data?.transaction_id as string) ??
            (data?.checkout_id as string) ??
            (data?.reference as string) ??
            request.reference,
          message: (data?.message as string) ?? "Payment initiated successfully",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.message as string) ??
          (data?.error as string) ??
          `Mongike error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `Mongike error: ${msg}` };
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
      const rawStatus = (
        (data?.status ?? data?.payment_status ?? data?.transaction_status ?? "") as string
      ).toUpperCase();

      let status: TransactionStatus["status"] = "PENDING";
      if (["COMPLETED", "SUCCESS", "PAID", "SUCCESSFUL"].includes(rawStatus)) {
        status = "COMPLETED";
      } else if (["FAILED", "CANCELLED", "REJECTED", "ERROR"].includes(rawStatus)) {
        status = "FAILED";
      } else if (rawStatus === "EXPIRED") {
        status = "EXPIRED";
      }

      return {
        status,
        providerRef: (data?.transaction_id as string) ?? providerRef,
        amount: data?.amount ? Number(data.amount) : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[MONGIKE] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────────────

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      console.error("[MONGIKE] Webhook secret not configured — rejecting webhook. Set webhookSecret on the PaymentChannel record.");
      return { verified: false, reason: "Webhook secret not configured" };
    }

    const hmacSig =
      (headers["x-mongike-signature"] as string) ??
      (headers["x-webhook-signature"] as string);

    if (hmacSig) {
      const expected = computeHmac(this.webhookSecret, rawBody);
      const valid = timingSafeEqual(hmacSig, expected);
      return { verified: valid, reason: valid ? undefined : "HMAC signature mismatch" };
    }

    const secretHeader =
      (headers["x-webhook-secret"] as string) ??
      (headers["x-mongike-secret"] as string);
    if (secretHeader) {
      const valid = timingSafeEqual(secretHeader, this.webhookSecret);
      return { verified: valid, reason: valid ? undefined : "Secret mismatch" };
    }

    return { verified: false, reason: "No signature header found" };
  }

  // ── Parse Webhook Payload ─────────────────────────────────────────────────

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b = body as Record<string, unknown>;

    const rawStatus = (
      (b?.status ?? b?.payment_status ?? b?.transaction_status ?? "") as string
    ).toUpperCase();

    const resultCode =
      ["COMPLETED", "SUCCESS", "PAID", "SUCCESSFUL"].includes(rawStatus) ? "0" : "1";

    return {
      transactionRef:
        (b?.reference as string) ??
        (b?.account_reference as string) ??
        (b?.order_id as string) ??
        "",
      providerRef:
        (b?.transaction_id as string) ??
        (b?.provider_ref as string) ??
        undefined,
      resultCode,
      resultMessage: (b?.message as string) ?? rawStatus,
      amount: b?.amount ? Number(b.amount) : undefined,
      phone:
        (b?.phone_number as string) ??
        (b?.phone as string) ??
        undefined,
      rawBody: body,
    };
  }
}
