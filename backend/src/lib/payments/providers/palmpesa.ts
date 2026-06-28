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

  private normalizeResponseBody(rawData: unknown): Record<string, unknown> {
    if (typeof rawData === "string") {
      const parsed = safeJsonParse<Record<string, unknown>>(rawData, {});
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    }

    return (rawData as Record<string, unknown>) ?? {};
  }

  private getResponseCode(data: Record<string, unknown>): string {
    const value =
      data?.ResponseCode ??
      data?.responseCode ??
      data?.ResultCode ??
      data?.resultCode ??
      data?.status ??
      data?.Status ??
      data?.code ??
      data?.Code ??
      "";

    return String(value ?? "").trim().toUpperCase();
  }

  private getResponseMessage(data: Record<string, unknown>, rawText: string): string {
    const message =
      (data?.ResponseDescription as string | undefined) ??
      (data?.responseDescription as string | undefined) ??
      (data?.ResultDesc as string | undefined) ??
      (data?.resultDesc as string | undefined) ??
      (data?.message as string | undefined) ??
      (data?.Message as string | undefined) ??
      (rawText || "");

    return typeof message === "string" && message.trim() ? message.trim() : "";
  }

  private getProviderRef(data: Record<string, unknown>): string | undefined {
    const providerRef =
      (data?.CheckoutRequestID as string | undefined) ??
      (data?.checkout_request_id as string | undefined) ??
      (data?.transaction_id as string | undefined) ??
      (data?.TransactionId as string | undefined) ??
      (data?.transactionId as string | undefined) ??
      (data?.order_id as string | undefined) ??
      (data?.OrderId as string | undefined) ??
      undefined;

    return typeof providerRef === "string" && providerRef.trim() ? providerRef.trim() : undefined;
  }

  private evaluateResponseSuccess(
    result: { ok: boolean; status: number },
    data: Record<string, unknown>,
    rawText: string,
    responseCode: string,
    providerRef: string | undefined,
    message: string
  ): boolean {
    const explicitSuccess = ["0", "00", "SUCCESS", "SUCCESSFUL", "ACCEPTED", "APPROVED", "OK"].includes(responseCode);
    const explicitFailure = ["1", "-1", "FAILED", "FAIL", "DECLINED", "REJECTED", "CANCELLED", "CANCELED", "ERROR", "EXPIRED"].includes(responseCode);
    const successText = /\b(success|successful|accepted|approved|ok|initiated|processing|queued|created|pending)\b/i.test(rawText || message);

    if (result.ok && (explicitSuccess || data?.success === true || data?.success === "true")) {
      return true;
    }

    if (result.ok && !explicitFailure && (successText || Boolean(providerRef))) {
      return true;
    }

    return false;
  }

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
      const requestUrl = `${this.apiUrl}/process-payment`;
      const maskedHeaders = {
        ...this.headers,
        Authorization: this.headers.Authorization ? "Bearer [REDACTED]" : "",
      };

      if (process.env.PALMPESA_DEBUG === "1") {
        console.log("===== PALMPESA REQUEST =====", {
          method: "POST",
          url: requestUrl,
          headers: maskedHeaders,
          payload,
        });
      }

      const result = await retryWithBackoff(
        () =>
          httpPost(requestUrl, payload, this.headers),
        2
      );

      const rawData = result.data;
      const rawText = typeof rawData === "string" ? rawData.trim() : "";
      const data = this.normalizeResponseBody(rawData);
      const responseCode = this.getResponseCode(data);
      const message = this.getResponseMessage(data, rawText);
      const providerRef = this.getProviderRef(data);
      const isSuccess = this.evaluateResponseSuccess(result, data, rawText, responseCode, providerRef, message);

      if (process.env.PALMPESA_DEBUG === "1") {
        console.log("===== PALMPESA RESPONSE =====", {
          httpStatus: result.status,
          rawBody: rawData,
          parsedBody: data,
          responseCode,
          successEvaluation: isSuccess,
          providerRef,
          message,
        });
      }

      if (isSuccess) {
        return {
          success: true,
          providerRef,
          message: message || (rawText ? rawText : "Payment initiated"),
          rawResponse: rawData,
          status: responseCode || "SUCCESS",
          code: responseCode || undefined,
        };
      }

      if (result.ok && !rawText) {
        return {
          success: false,
          message: "PalmPesa returned HTTP 200 but response body was empty.",
          rawResponse: rawData,
          status: responseCode || "EMPTY",
          code: responseCode || "EMPTY",
        };
      }

      if (result.ok) {
        return {
          success: false,
          message: message || `PalmPesa returned an unknown response format. HTTP ${result.status}`,
          rawResponse: rawData,
          status: responseCode || "UNKNOWN",
          code: responseCode || "UNKNOWN",
        };
      }

      return {
        success: false,
        message: message || `PalmPesa error (HTTP ${result.status})`,
        rawResponse: rawData,
        status: responseCode || `HTTP_${result.status}`,
        code: responseCode || `HTTP_${result.status}`,
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
