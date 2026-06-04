/**
 * Payment Architecture – Shared Types & Interfaces
 * All providers must implement the PaymentProvider interface.
 */

// ─── Provider Names ───────────────────────────────────────────────────────────
export type ProviderName = "PALMPESA" | "ZENOPAY" | "MONGIKE" | "HARAKAPAY";

// ─── Payment Request ──────────────────────────────────────────────────────────
export interface PaymentRequest {
  /** Amount in TZS (Tanzanian Shillings), must be > 0 */
  amount: number;
  /** Phone number — will be normalized to 255XXXXXXXXX by utils */
  phone: string;
  /** Our internal unique transaction reference (e.g. HP-XXXX) */
  reference: string;
  /** Human-readable description shown on the prompt */
  description?: string;
  /** Full URL the provider will POST the callback to */
  callbackUrl: string;
  /** Optional buyer info (some providers require these) */
  buyerName?: string;
  buyerEmail?: string;
  /** Any extra fields passed through to the provider */
  metadata?: Record<string, unknown>;
}

// ─── Payment Response (after initiation) ─────────────────────────────────────
export interface PaymentResponse {
  /** Did the provider accept the request? */
  success: boolean;
  /** Provider's own checkout / order ID for tracking */
  providerRef?: string;
  /** Human-readable message from provider */
  message: string;
  /** Full raw API response for logging */
  rawResponse?: unknown;
}

// ─── Transaction Status ───────────────────────────────────────────────────────
export interface TransactionStatus {
  status: "PENDING" | "COMPLETED" | "FAILED" | "EXPIRED";
  providerRef?: string;
  amount?: number;
  paidAt?: Date;
  rawResponse?: unknown;
}

// ─── Webhook Verification Result ─────────────────────────────────────────────
export interface WebhookVerification {
  /** Was the signature valid? */
  verified: boolean;
  /** Reason for rejection if not verified */
  reason?: string;
}

// ─── Parsed Webhook Payload (normalised across providers) ────────────────────
export interface ParsedWebhookPayload {
  /** Our internal reference sent during initiation */
  transactionRef: string;
  /** Provider's transaction ID */
  providerRef?: string;
  /** "0" or "SUCCESS" means paid; anything else is failure */
  resultCode: string;
  resultMessage?: string;
  amount?: number;
  phone?: string;
  /** Raw provider body for logging */
  rawBody: unknown;
}

// ─── Config passed to each provider instance ─────────────────────────────────
export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  apiUrl?: string;
  webhookSecret?: string;
  accountId?: string;
  environment: "sandbox" | "live";
}

// ─── Core interface every provider must implement ─────────────────────────────
export interface PaymentProvider {
  readonly name: ProviderName;

  /**
   * Initiate a mobile money payment (STK push / USSD prompt).
   */
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * Poll the provider for the current status of a transaction.
   */
  checkStatus(providerRef: string): Promise<TransactionStatus>;

  /**
   * Verify the authenticity of an incoming webhook request.
   */
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<WebhookVerification>;

  /**
   * Parse the provider's webhook body into a normalised shape.
   */
  parseWebhookPayload(body: unknown): ParsedWebhookPayload;
}

// ─── Result from processing a webhook ────────────────────────────────────────
export interface WebhookResult {
  processed: boolean;
  transactionRef?: string;
  status?: "COMPLETED" | "FAILED";
  message: string;
}
