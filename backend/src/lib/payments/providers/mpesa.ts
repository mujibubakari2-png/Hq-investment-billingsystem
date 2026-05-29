/**
 * M-Pesa Payment Provider (E11 FIX)
 *
 * M-Pesa Tanzania (Vodacom) — STK Push via the Daraja API.
 * Was referenced in .env.example but the provider class and registry
 * entry were missing entirely. This implements the full PaymentProvider
 * interface to match the existing providers.
 *
 * Required env vars (or DB PaymentChannel fields):
 *   MPESA_API_KEY       — Consumer Key from Daraja portal
 *   MPESA_API_SECRET    — Consumer Secret from Daraja portal
 *   MPESA_SHORTCODE     — Business shortcode (Paybill / Till)
 *   MPESA_PASSKEY       — Lipa Na M-Pesa Online passkey
 *   MPESA_API_URL       — Base URL (sandbox or production)
 *   MPESA_WEBHOOK_SECRET — Optional, for signature verification
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
  httpPost,
  httpGet,
  retryWithBackoff,
  timingSafeEqual,
} from "@/lib/payments/utils";

// Extended config for M-Pesa specific fields
interface MpesaConfig extends ProviderConfig {
  shortCode?: string;
  passKey?: string;
}

export class MpesaProvider implements PaymentProvider {
  readonly name = "MPESA" as const;

  private apiKey: string;
  private apiSecret: string;
  private apiUrl: string;
  private shortCode: string;
  private passKey: string;
  private webhookSecret: string;
  private environment: "sandbox" | "live";

  constructor(config: MpesaConfig) {
    if (!config.apiKey) throw new Error("MpesaProvider: apiKey (Consumer Key) is required");
    if (!config.apiSecret) throw new Error("MpesaProvider: apiSecret (Consumer Secret) is required");

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.environment = config.environment ?? "sandbox";
    this.apiUrl =
      config.apiUrl ??
      (this.environment === "live"
        ? "https://api.safaricom.co.tz"
        : "https://sandbox.safaricom.co.tz");
    this.shortCode = config.shortCode ?? process.env.MPESA_SHORTCODE ?? "";
    this.passKey = config.passKey ?? process.env.MPESA_PASSKEY ?? "";
    this.webhookSecret = config.webhookSecret ?? process.env.MPESA_WEBHOOK_SECRET ?? "";
  }

  // ── OAuth Token ───────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64");
    const res = await fetch(`${this.apiUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!res.ok) throw new Error(`[MPESA] Token fetch failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  // ── STK Push Timestamp & Password ────────────────────────────────────────

  private getTimestamp(): string {
    return new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
  }

  private getPassword(timestamp: string): string {
    return Buffer.from(`${this.shortCode}${this.passKey}${timestamp}`).toString("base64");
  }

  // ── Initiate Payment (STK Push) ───────────────────────────────────────────

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.getPassword(timestamp);
      const phone = formatPhoneTZ(request.phone);

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(request.amount),
        PartyA: phone,
        PartyB: this.shortCode,
        PhoneNumber: phone,
        CallBackURL: request.callbackUrl,
        AccountReference: request.reference,
        TransactionDesc: request.description ?? `Payment ${request.reference}`,
      };

      const result = await retryWithBackoff(
        () =>
          httpPost(`${this.apiUrl}/mpesa/stkpush/v1/processrequest`, payload, {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }),
        2
      );

      const data = result.data as Record<string, unknown>;

      if (result.ok && (data?.ResponseCode === "0" || data?.errorCode === undefined)) {
        return {
          success: true,
          providerRef: (data?.CheckoutRequestID as string) ?? undefined,
          message: (data?.CustomerMessage as string) ?? "STK push sent",
          rawResponse: data,
        };
      }

      return {
        success: false,
        message:
          (data?.errorMessage as string) ??
          (data?.ResponseDescription as string) ??
          "M-Pesa STK push failed",
        rawResponse: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      return { success: false, message: `M-Pesa error: ${msg}` };
    }
  }

  // ── Check Transaction Status ──────────────────────────────────────────────

  async checkStatus(providerRef: string): Promise<TransactionStatus> {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = this.getPassword(timestamp);

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: providerRef,
      };

      const result = await httpPost(
        `${this.apiUrl}/mpesa/stkpushquery/v1/query`,
        payload,
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      );

      const data = result.data as Record<string, unknown>;
      const resultCode = String(data?.ResultCode ?? "1");

      let status: TransactionStatus["status"] = "PENDING";
      if (resultCode === "0") {
        status = "COMPLETED";
      } else if (["1032", "17", "2001"].includes(resultCode)) {
        // 1032 = cancelled, 17 = failed limit, 2001 = wrong PIN
        status = "FAILED";
      }

      return { status, providerRef, rawResponse: data };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.error(`[MPESA] checkStatus error: ${msg}`);
      return { status: "PENDING" };
    }
  }

  // ── Webhook Verification ──────────────────────────────────────────────────

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    _rawBody: string
  ): Promise<WebhookVerification> {
    if (!this.webhookSecret) {
      console.warn("[MPESA] No webhook secret configured — skipping verification");
      return { verified: true, reason: "No secret configured" };
    }
    const provided =
      (headers["x-mpesa-signature"] as string) ??
      (headers["x-webhook-secret"] as string) ??
      "";
    if (!provided) return { verified: false, reason: "Missing webhook signature header" };
    const valid = timingSafeEqual(provided, this.webhookSecret);
    return { verified: valid, reason: valid ? undefined : "Webhook signature mismatch" };
  }

  // ── Parse Webhook Payload ─────────────────────────────────────────────────

  parseWebhookPayload(body: unknown): ParsedWebhookPayload {
    const b = body as Record<string, unknown>;
    // M-Pesa Daraja callback structure
    const stk = (b?.Body as Record<string, unknown>)?.stkCallback as Record<string, unknown> | undefined;
    const items = (stk?.CallbackMetadata as Record<string, unknown>)?.Item as Array<Record<string, unknown>> | undefined;

    const getItem = (name: string) =>
      items?.find((i) => i.Name === name)?.Value as string | number | undefined;

    return {
      transactionRef: (b?.AccountReference as string) ?? "",
      providerRef: (stk?.CheckoutRequestID as string) ?? (b?.CheckoutRequestID as string) ?? undefined,
      resultCode: String(stk?.ResultCode ?? b?.ResultCode ?? "1"),
      resultMessage: (stk?.ResultDesc as string) ?? (b?.ResultDesc as string) ?? undefined,
      amount: getItem("Amount") ? Number(getItem("Amount")) : undefined,
      phone: getItem("PhoneNumber") ? String(getItem("PhoneNumber")) : undefined,
      rawBody: body,
    };
  }
}
