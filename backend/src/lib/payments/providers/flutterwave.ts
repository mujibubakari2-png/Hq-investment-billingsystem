/**
 * PAY: Flutterwave Payment Provider
 *
 * Supports mobile money, card, and bank payments across Africa.
 * Particularly useful for cross-border payments and non-Tanzanian ISP clients
 * (Uganda, Kenya, Rwanda, Ghana, Nigeria, etc.).
 *
 * API (v3):
 *   - Initiate:  POST https://api.flutterwave.com/v3/payments          (hosted link)
 *     OR         POST https://api.flutterwave.com/v3/charges?type=mobile_money_tanzania
 *   - Status:    GET  https://api.flutterwave.com/v3/transactions/{id}/verify
 *   - Webhook:   POST — verified with verif-hash header (secret token)
 *
 * Environment variables:
 *   FLUTTERWAVE_SECRET_KEY    — FLWSECK_... from Flutterwave Dashboard
 *   FLUTTERWAVE_WEBHOOK_HASH  — your custom verification hash (Dashboard → Webhooks)
 *   FLUTTERWAVE_API_URL       — default https://api.flutterwave.com/v3
 *   FLUTTERWAVE_CURRENCY      — ISO 4217 code, default TZS
 *
 * Docs: https://developer.flutterwave.com/reference
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
    timingSafeEqual,
    httpPost,
    httpGet,
    retryWithBackoff,
} from "@/lib/payments/utils";

const FLW_DEFAULT_URL = "https://api.flutterwave.com/v3";

export class FlutterwaveProvider implements PaymentProvider {
    readonly name = "FLUTTERWAVE" as const;

    private secretKey: string;
    private webhookHash: string;
    private apiUrl: string;
    private currency: string;
    private environment: "sandbox" | "live";

    constructor(config: ProviderConfig) {
        if (!config.apiKey) throw new Error("Flutterwave: apiKey (secret key) is required");
        if (!config.webhookSecret) {
            console.warn("[FLUTTERWAVE] webhookSecret (verif-hash) not set — webhook verification will reject all events.");
        }
        this.secretKey   = config.apiKey;
        this.webhookHash = config.webhookSecret ?? "";
        this.apiUrl      = config.apiUrl ?? process.env.FLUTTERWAVE_API_URL ?? FLW_DEFAULT_URL;
        this.currency    = (config as any).currency ?? process.env.FLUTTERWAVE_CURRENCY ?? "TZS";
        this.environment = config.environment;
    }

    private get headers(): Record<string, string> {
        return {
            "Authorization": `Bearer ${this.secretKey}`,
            "Content-Type":  "application/json",
        };
    }

    // ── Initiate Payment ──────────────────────────────────────────────────────
    // Uses Flutterwave's Standard (hosted payment link) approach.
    // This works for both card and mobile money — Flutterwave's UI handles routing.

    async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
        const payload: Record<string, unknown> = {
            tx_ref:          request.reference,
            amount:          Math.round(request.amount),
            currency:        this.currency,
            redirect_url:    request.callbackUrl,
            payment_options: "card,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyuganda,mpesa",
            customer: {
                email:        request.buyerEmail ?? "customer@yourdomain.com",
                name:         request.buyerName  ?? "Customer",
                phonenumber:  request.phone,
            },
            customizations: {
                title:       "HQ Investment ISP",
                description: request.description ?? "ISP Subscription Payment",
                logo:        process.env.NEXT_PUBLIC_APP_LOGO_URL ?? "",
            },
            meta: {
                reference: request.reference,
            },
        };

        try {
            const result = await retryWithBackoff(
                () => httpPost(`${this.apiUrl}/payments`, payload, this.headers),
                2
            );
            const data = result.data as Record<string, unknown>;

            // Flutterwave returns { status: "success", message, data: { link } }
            if (result.ok && data?.status === "success" && (data?.data as any)?.link) {
                return {
                    success:     true,
                    providerRef: request.reference,     // tx_ref is our own reference
                    message:     (data?.message as string) ?? "Payment link created",
                    rawResponse: { link: (data?.data as any)?.link },
                };
            }

            return {
                success:     false,
                message:     (data?.message as string) ?? `Flutterwave error (HTTP ${result.status})`,
                rawResponse: data,
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Network error";
            return { success: false, message: `Flutterwave error: ${msg}` };
        }
    }

    // ── Check Status ──────────────────────────────────────────────────────────
    // providerRef is the Flutterwave transaction ID (numeric string from webhook)
    // or the tx_ref (our reference) — we handle both.

    async checkStatus(providerRef: string): Promise<TransactionStatus> {
        try {
            // If it's a numeric ID, verify by transaction ID directly
            // Otherwise query by tx_ref
            const isNumeric = /^\d+$/.test(providerRef);
            const path = isNumeric
                ? `/transactions/${providerRef}/verify`
                : `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerRef)}`;

            const result = await httpGet(`${this.apiUrl}${path}`, this.headers);
            const data   = result.data as Record<string, unknown>;
            const inner  = (data?.data as Record<string, unknown>) ?? {};

            const rawStatus = ((inner?.status ?? "") as string).toUpperCase();

            let status: TransactionStatus["status"] = "PENDING";
            if (rawStatus === "SUCCESSFUL") {
                status = "COMPLETED";
            } else if (rawStatus === "FAILED" || rawStatus === "CANCELLED") {
                status = "FAILED";
            }

            return {
                status,
                providerRef: String(inner?.id ?? providerRef),
                amount:      inner?.amount ? Number(inner.amount) : undefined,
                paidAt:      inner?.created_at ? new Date(inner.created_at as string) : undefined,
                rawResponse: inner,
            };
        } catch (e: unknown) {
            console.error("[FLUTTERWAVE] checkStatus error:", e);
            return { status: "PENDING" };
        }
    }

    // ── Webhook Verification ──────────────────────────────────────────────────
    // Flutterwave sends a `verif-hash` header equal to the secret hash you set
    // in the Dashboard. Simple timing-safe string comparison — no HMAC needed.

    async verifyWebhook(
        headers: Record<string, string | string[] | undefined>,
        _rawBody: string
    ): Promise<WebhookVerification> {
        if (!this.webhookHash) {
            console.error("[FLUTTERWAVE] webhookSecret (verif-hash) not configured — rejecting webhook.");
            return { verified: false, reason: "Webhook hash not configured" };
        }

        const incoming = headers["verif-hash"] as string | undefined;
        if (!incoming) return { verified: false, reason: "Missing verif-hash header" };

        const valid = timingSafeEqual(incoming, this.webhookHash);
        return { verified: valid, reason: valid ? undefined : "verif-hash mismatch" };
    }

    // ── Parse Webhook Payload ─────────────────────────────────────────────────

    parseWebhookPayload(body: unknown): ParsedWebhookPayload {
        const b    = body as Record<string, unknown>;
        const data = (b?.data as Record<string, unknown>) ?? {};

        // Flutterwave sends { event: "charge.completed", data: { status, tx_ref, id, amount, ... } }
        const rawStatus  = ((data?.status ?? "") as string).toUpperCase();
        const resultCode = rawStatus === "SUCCESSFUL" ? "0" : "1";

        return {
            transactionRef:
                (data?.tx_ref as string) ??
                (b?.txRef as string) ??
                "",
            providerRef:   String(data?.id ?? ""),
            resultCode,
            resultMessage: (b?.event as string) ?? rawStatus,
            amount:        data?.amount ? Number(data.amount) : undefined,
            phone:         (data?.customer as any)?.phone_number ?? undefined,
            rawBody:       body,
        };
    }
}
