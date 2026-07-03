/**
 * PalmPesa Payment Provider
 *
 * PalmPesa aggregates TZ mobile money networks (M-Pesa, Airtel, Tigo, Halo, TTCL)
 * into a single wallet. Contact: Support@palmpesa.co.tz
 *
 * Auth: Bearer token (API Key)
 * Base URL: https://palmpesa.drmlelwa.co.tz
 *
 * Official docs: https://documentation.palmpesa.co.tz
 *
 * ENDPOINTS USED (as per official docs):
 *
 *   [Endpoint 02 â€“ Webhook Payment using phone number]  â† STK/USSD push
 *   POST /api/palmpesa/initiate
 *   Required fields: name, email, phone, amount, transaction_id, address, postcode, callback_url
 *   Response: { message, order_id }
 *   Callback:  { order_id, payment_status }   // payment_status: COMPLETED | FAILED | PENDING
 *
 *   [Endpoint 04 â€“ Get Order Status]
 *   POST /api/order-status
 *   Body: { order_id }
 *   Response: { reference, resultcode, result, message, data[{ order_id, amount, payment_status, transid, channel, msisdn }] }
 *
 * REMOVED (FIX-PP-002):
 *   Endpoint 01 (/api/process-payment) returns a hosted payment_gateway_url (Pay by Link),
 *   NOT a USSD push. It is not suitable for automated ISP billing flows. Switched to
 *   Endpoint 02 (/api/palmpesa/initiate) which directly pushes to the payer's phone.
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
  timingSafeEqual,
  httpPost,
  retryWithBackoff,
  safeJsonParse,
} from "@/lib/payments/utils";

export class PalmPesaProvider implements PaymentProvider {
  readonly name = "PALMPESA" as const;

  private apiKey: string;
  private apiUrl: string;
  private webhookSecret: string;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) throw new Error("PalmPesa: apiKey is required");
    this.apiKey = config.apiKey;

    const url = config.apiUrl ?? process.env.PALMPESA_API_URL ?? "https://palmpesa.drmlelwa.co.tz";
    this.apiUrl = url.replace(/\/$/, "");
    this.webhookSecret = config.webhookSecret ?? "";
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  // â”€â”€â”€ Initiate Payment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FIX-PP-002: Use Endpoint 02 (/api/palmpesa/initiate) for direct USSD push.
  // Docs: https://documentation.palmpesa.co.tz/#webhook
  // Fields: name, email, phone, amount, transaction_id, address, postcode, callback_url
  // The phone field accepts local format (07XXXXXXXX) per docs example.

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    logger.info("[TRACE][PalmPesaProvider.initiatePayment] ENTER", { request });

    // Docs example shows local format: "0693662424"
    const rawPhone = request.phone.replace(/\D/g, "");
    let phone: string;
    if (rawPhone.startsWith("255") && rawPhone.length === 12) {
      // Convert E.164 255XXXXXXXXX â†’ 07XXXXXXXXX
      phone = "0" + rawPhone.slice(3);
    } else if (rawPhone.startsWith("0") && rawPhone.length === 10) {
      phone = rawPhone;
    } else {
      phone = rawPhone;
    }

    const payload: Record<string, unknown> = {
      name:           request.buyerName    ?? "Customer",
      email:          request.buyerEmail   ?? "",
      phone:          phone,
      amount:         Math.round(request.amount),
      transaction_id: request.reference,
      address:        "Tanzania",
      postcode:       "00000",
      callback_url:   request.callbackUrl,
    };

    const requestUrl = `${this.apiUrl}/api/palmpesa/initiate`;

    const maskedHeaders = {
      ...this.headers,
      Authorization: "Bearer [REDACTED]",
    };
    logger.info("===== PALMPESA REQUEST =====", {
      method: "POST",
      url: requestUrl,
      headers: maskedHeaders,
      payload,
    });

    try {
      const result = await retryWithBackoff(
        () => httpPost(requestUrl, payload, this.headers),
        2
      );

      const rawData = result.data;
      const data: Record<string, unknown> =
        typeof rawData === "string"
          ? safeJsonParse<Record<string, unknown>>(rawData, {})
          : (rawData as Record<string, unknown>) ?? {};

      logger.info("===== PALMPESA RESPONSE =====", {
        httpStatus: result.status,
        rawBody: rawData,
        parsedBody: data,
      });

      // Docs success response: { message: "Payment initiated. Processing will continue asynchronously.", order_id: "PALMPESA..." }
      const orderId = (data?.order_id as string | undefined) ?? undefined;
      const message = (data?.message as string | undefined) ?? "";

      if (result.ok && orderId) {
        logger.info("[TRACE][PalmPesaProvider.initiatePayment] EXIT_SUCCESS", { orderId, message });
        return {
          success: true,
          providerRef: orderId,
          message:     message || "Payment initiated",
          rawResponse: rawData,
          status:      "PENDING",
        };
      }

      const errMsg =
        (data?.message as string | undefined) ??
        (data?.error   as string | undefined) ??
        `PalmPesa error (HTTP ${result.status})`;

      return {
        success:     false,
        message:     errMsg,
        rawResponse: rawData,
        status:      `HTTP_${result.status}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      logger.error("[TRACE][PalmPesaProvider.initiatePayment] EXCEPTION", { message: msg });
      return { success: false, message: `PalmPesa error: ${msg}` };
    }
  }

  // â”€â”€â”€ Check Transaction Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FIX-PP-001 (retained): POST /api/order-status with body { order_id }.
  // Response: data[0].payment_status = COMPLETED | PENDING | FAILED

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    try {
      const result = await httpPost(
        `${this.apiUrl}/api/order-status`,
        { order_id: providerRef },
        this.headers
      );

      const rawData = result.data;
      const data =
        typeof rawData === "string"
          ? safeJsonParse<Record<string, unknown>>(rawData, {})
          : (rawData as Record<string, unknown>);

      // Response wraps details inside data[0]
      const inner = Array.isArray(data?.data) ? (data.data as any[])[0] ?? {} : data ?? {};
      const rawStatus = String(
        inner?.payment_status ??
        data?.result           ??
        data?.resultcode       ??
        ""
      ).trim().toUpperCase();

      let status: TransactionStatus["status"] = "PENDING";
      if (rawStatus === "COMPLETED" || rawStatus === "SUCCESS" || rawStatus === "000") {
        status = "COMPLETED";
      } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED") {
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
      logger.error(`[PALMPESA] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // â”€â”€â”€ Webhook Verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PalmPesa does not document a webhook signature scheme.
  // We verify using a shared secret in x-webhook-secret or x-palmpesa-signature.

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    _rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      logger.error(
        "[PALMPESA] Webhook secret not configured â€” rejecting webhook. " +
        "Set webhookSecret on the PaymentChannel record."
      );
      return { verified: false, reason: "Webhook secret not configured" };
    }

    const provided =
      (headers["x-webhook-secret"]     as string | undefined) ??
      (headers["x-palmpesa-signature"] as string | undefined) ??
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

  // â”€â”€â”€ Parse Webhook Payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Endpoint 02 callback (official docs):
  //   { order_id: "PALMPESA17683440586334", payment_status: "COMPLETED" | "FAILED" | "PENDING" }
  //
  // Note: The callback only contains order_id and payment_status.
  // Our transaction_id was sent as transaction_id during initiation.
  // The order_id returned by PalmPesa must be stored as providerRef so we can
  // match it here. Our internal reference (transaction_id) is NOT echoed back
  // in the Endpoint 02 callback â€” we match via providerRef stored at initiation.

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b =
      typeof body === "string"
        ? safeJsonParse<Record<string, unknown>>(body, {})
        : (body as Record<string, unknown>);

    const rawStatus = String(
      b?.payment_status ?? b?.status ?? "PENDING"
    ).trim().toUpperCase();

    const isSuccess = rawStatus === "COMPLETED" || rawStatus === "SUCCESS";
    const resultCode = isSuccess ? "0" : "1";

    // The order_id from callback is PalmPesa's reference (providerRef).
    // transactionRef = providerRef because Endpoint 02 does not echo our transaction_id.
    const orderId =
      (b?.order_id      as string | undefined) ??
      (b?.transaction_id as string | undefined) ??
      "";

    return {
      // Use order_id as transactionRef so processWebhook can match it via providerRef
      transactionRef: orderId,
      providerRef:    orderId || undefined,
      resultCode,
      resultMessage:  rawStatus,
      amount:         b?.amount != null ? Number(b.amount) : undefined,
      phone:          undefined,
      rawBody:        body,
    };
  }
}
