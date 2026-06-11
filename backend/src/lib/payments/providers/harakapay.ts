/**
 * HarakaPay Payment Provider
 *
 * HarakaPay payment gateway for East Africa mobile money collections.
 * Portal: https://harakapayment.com  |  https://harakapay.net
 *
 * ⚠️  Update endpoint URLs below once you receive credentials from HarakaPay portal.
 *
 * Auth: API Key + Secret in headers
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

export class HarakaPayProvider implements PaymentProvider {
  readonly name = "HARAKAPAY" as const;

  private apiKey: string;
  private apiSecret: string;
  private apiUrl: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("HarakaPay: apiKey is required");
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret ?? "";
    const url = config.apiUrl ?? process.env.HARAKAPAY_API_URL;
    if (!url) {
      throw new Error("HarakaPay: API URL is not configured. Set HARAKAPAY_API_URL in environment variables or channel config.");
    }
    this.apiUrl = url;
    this.webhookSecret = config.webhookSecret ?? "";
    this.environment = process.env.NODE_ENV === 'production' ? "live" : (config.environment ?? "sandbox");
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Api-Key": this.apiKey,
      "X-Api-Secret": this.apiSecret,
      "X-Environment": this.environment,
    };
  }

  // ── Initiate Payment ──────────────────────────────────────────────────────

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const phone = formatPhoneTZ(request.phone);

    const payload: Record<string, unknown> = {
      reference: request.reference,
      amount: Math.round(request.amount),
      currency: "TZS",
      msisdn: phone,
      msisdn_local: formatPhoneLocal(request.phone),
      customer_name: request.buyerName ?? "Customer",
      customer_email: request.buyerEmail ?? "",
      narration: request.description ?? `Payment ${request.reference}`,
      callback_url: request.callbackUrl,
      environment: this.environment,
    };

    try {
      const result = await retryWithBackoff(
        () =>
          httpPost(
            `${this.apiUrl}/payments/collect`,
            payload,
            this.headers
          ),
        2
      );

      const data = result.data as Record<string, unknown>;

      if (
        result.ok &&
        (data?.success === true ||
          data?.status === "success" ||
          data?.ResponseCode === "0" ||
          data?.code === "0" ||
          data?.code === 0)
      ) {
        return {
          success: true,
          providerRef:
            (data?.transaction_id as string) ??
            (data?.reference_id as string) ??
            (data?.CheckoutRequestID as string) ??
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
          `HarakaPay error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `HarakaPay error: ${msg}` };
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
        (data?.status ?? data?.transaction_status ?? data?.ResultCode ?? "") as string
      ).toUpperCase();

      let status: TransactionStatus["status"] = "PENDING";
      if (["COMPLETED", "SUCCESS", "PAID", "SUCCESSFUL", "0"].includes(rawStatus)) {
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
      console.error(`[HARAKAPAY] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────────────

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      // PAY-003/PAY-004 FIX: Reject webhooks when no secret is configured.
      // Previously this returned verified:true which allowed anyone to forge payment confirmations.
      console.error("[HARAKAPAY] Webhook secret not configured — rejecting webhook. Set webhookSecret on the PaymentChannel record.");
      return { verified: false, reason: "Webhook secret not configured" };
    }

    // Try HMAC-SHA256 first
    const hmacSig =
      (headers["x-haraka-signature"] as string) ??
      (headers["x-webhook-signature"] as string);

    if (hmacSig) {
      const expected = computeHmac(this.webhookSecret, rawBody);
      const valid = timingSafeEqual(hmacSig, expected);
      return { verified: valid, reason: valid ? undefined : "HMAC mismatch" };
    }

    // Fallback: shared secret header
    const secretHeader =
      (headers["x-webhook-secret"] as string) ??
      (headers["x-haraka-secret"] as string);
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
      (b?.status ?? b?.transaction_status ?? b?.ResultCode ?? "") as string
    ).toUpperCase();

    const resultCode =
      ["COMPLETED", "SUCCESS", "PAID", "SUCCESSFUL", "0"].includes(rawStatus)
        ? "0"
        : "1";

    return {
      transactionRef:
        (b?.reference as string) ??
        (b?.account_reference as string) ??
        (b?.AccountReference as string) ??
        "",
      providerRef:
        (b?.transaction_id as string) ??
        (b?.TransactionId as string) ??
        undefined,
      resultCode,
      resultMessage:
        (b?.message as string) ??
        (b?.ResultDesc as string) ??
        rawStatus,
      amount: b?.amount ? Number(b.amount) : undefined,
      phone:
        (b?.msisdn as string) ??
        (b?.PhoneNumber as string) ??
        undefined,
      rawBody: body,
    };
  }
}
