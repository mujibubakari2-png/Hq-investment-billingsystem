/**
 * PalmPesa Payment Provider
 *
 * PalmPesa aggregates TZ mobile money networks (M-Pesa, Airtel, Tigo, Halo, TTCL)
 * into a single wallet. Contact: Support@palmpesa.co.tz
 *
 * Auth: Bearer token (API Key)
 * Base URL: https://palmpesa.drmlelwa.co.tz/api
 *
 * Confirmed endpoints (from official docs):
 *   STK Push  : POST /api/process-payment
 *   Status    : GET  /api/order-status  (body: { order_id })
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
  httpGet,
  retryWithBackoff,
  safeJsonParse,
} from "@/lib/payments/utils";

export class PalmPesaProvider implements PaymentProvider {
  readonly name = "PALMPESA" as const;

  private apiKey: string;
  private apiUrl: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("PalmPesa: apiKey is required");
    this.apiKey = config.apiKey;
    const url = config.apiUrl ?? process.env.PALMPESA_API_URL;
    if (!url) {
      throw new Error(
        "PalmPesa: API URL is not configured. Set PALMPESA_API_URL in environment variables or channel config."
      );
    }
    this.apiUrl = url.replace(/\/$/, ""); // strip trailing slash
    this.webhookSecret = config.webhookSecret ?? "";
    this.environment =
      process.env.NODE_ENV === "production"
        ? "live"
        : (config.environment ?? "sandbox");
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "X-Environment": this.environment,
    };
  }

  // ── Initiate Payment (STK Push) ───────────────────────────────────────────
  // Confirmed endpoint: POST /api/process-payment
  // Docs: https://palmpesa-docs.netlify.app

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const phone = formatPhoneTZ(request.phone);

    const payload = {
      PhoneNumber: phone,
      Amount: Math.round(request.amount),
      AccountReference: request.reference,
      TransactionDesc: request.description ?? `Payment ${request.reference}`,
      CallbackUrl: request.callbackUrl,
      BuyerName: request.buyerName,
      BuyerEmail: request.buyerEmail,
    };

    try {
      const result = await retryWithBackoff(
        () =>
          httpPost(`${this.apiUrl}/process-payment`, payload, this.headers),
        2
      );

      const rawData = result.data;
      const data =
        typeof rawData === "string"
          ? safeJsonParse<Record<string, unknown>>(rawData, {})
          : (rawData as Record<string, unknown>);
      const responseCode = String(
        data?.ResponseCode ??
        data?.responseCode ??
        data?.ResultCode ??
        data?.resultCode ??
        data?.status ??
        ""
      )
        .trim()
        .toUpperCase();
      const isSuccess =
        result.ok &&
        (data?.success === true ||
          data?.success === "true" ||
          responseCode === "0" ||
          responseCode === "00" ||
          responseCode === "SUCCESS" ||
          responseCode === "SUCCESSFUL");

      if (isSuccess) {
        return {
          success: true,
          providerRef:
            (data?.CheckoutRequestID as string) ??
            (data?.checkout_request_id as string) ??
            (data?.transaction_id as string) ??
            undefined,
          message: (data?.ResponseDescription as string) ?? "Payment initiated",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.ResponseDescription as string) ??
          (data?.message as string) ??
          `PalmPesa error (HTTP ${result.status})`,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `PalmPesa error: ${msg}` };
    }
  }

  // ── Check Transaction Status ──────────────────────────────────────────────
  // Confirmed endpoint: GET /api/order-status?order_id={providerRef}

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    try {
      const result = await httpGet(
        `${this.apiUrl}/order-status?order_id=${encodeURIComponent(providerRef)}`,
        this.headers
      );

      const rawData = result.data;
      const data =
        typeof rawData === "string"
          ? safeJsonParse<Record<string, unknown>>(rawData, {})
          : (rawData as Record<string, unknown>);
      const rawStatus = String(
        data?.ResultCode ??
        data?.result_code ??
        data?.status ??
        data?.order_status ??
        ""
      ).trim().toUpperCase();

      let status: TransactionStatus["status"] = "PENDING";
      if (
        rawStatus === "0" ||
        rawStatus === "00" ||
        rawStatus === "SUCCESS" ||
        rawStatus === "SUCCESSFUL" ||
        rawStatus === "COMPLETED" ||
        rawStatus === "PAID"
      ) {
        status = "COMPLETED";
      } else if (
        rawStatus === "FAILED" ||
        rawStatus === "CANCELLED" ||
        rawStatus === "REJECTED"
      ) {
        status = "FAILED";
      } else if (rawStatus === "EXPIRED") {
        status = "EXPIRED";
      }

      return {
        status,
        providerRef,
        amount: data?.Amount ? Number(data.Amount) : undefined,
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[PALMPESA] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────────────

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    _rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      console.error(
        "[PALMPESA] Webhook secret not configured — rejecting webhook. " +
        "Set webhookSecret on the PaymentChannel record."
      );
      return { verified: false, reason: "Webhook secret not configured" };
    }

    const provided =
      (headers["x-webhook-secret"] as string) ??
      (headers["x-palmpesa-signature"] as string) ??
      "";

    if (!provided) {
      return { verified: false, reason: "Missing webhook signature header" };
    }

    const valid = timingSafeEqual(provided, this.webhookSecret);
    return {
      verified: valid,
      reason: valid ? undefined : "Webhook signature mismatch",
    };
  }

  // ── Parse Webhook Payload ─────────────────────────────────────────────────

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b =
      typeof body === "string"
        ? safeJsonParse<Record<string, unknown>>(body, {})
        : (body as Record<string, unknown>);

    // PalmPesa sends ResultCode "0" for success
    const resultCode = String(
      b?.ResultCode ?? b?.result_code ?? b?.status ?? "1"
    ).trim();

    return {
      transactionRef:
        (b?.AccountReference as string) ??
        (b?.account_reference as string) ??
        "",
      providerRef:
        (b?.TransactionId as string) ??
        (b?.transaction_id as string) ??
        undefined,
      resultCode,
      resultMessage:
        (b?.ResultDesc as string) ??
        (b?.result_desc as string) ??
        (b?.message as string) ??
        undefined,
      amount: b?.Amount ? Number(b.Amount) : undefined,
      phone: (b?.PhoneNumber as string) ?? undefined,
      rawBody: body,
    };
  }
}
