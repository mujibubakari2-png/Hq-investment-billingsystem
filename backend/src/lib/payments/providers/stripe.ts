/**
 * PAY: Stripe Payment Provider
 *
 * Supports international card payments via Stripe Checkout Sessions.
 * Used for SaaS subscription billing and international ISP clients who pay
 * with credit/debit cards (Visa, Mastercard, Amex).
 *
 * API:
 *   - Initiate: POST /v1/checkout/sessions (creates a hosted checkout page)
 *   - Status:   GET  /v1/checkout/sessions/{id} or /v1/payment_intents/{id}
 *   - Webhook:  POST — verified with stripe-signature header (HMAC-SHA256)
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY       — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET   — whsec_... from Stripe Dashboard
 *   STRIPE_CURRENCY         — ISO 4217 code, default USD
 *
 * Docs: https://stripe.com/docs/api/checkout/sessions
 *
 * NOTE: We use the Stripe REST API directly (no stripe npm package) to avoid
 * adding a heavy dependency. All calls use the standard fetch-based httpPost/httpGet
 * from payments/utils. Stripe's API is stable and well-documented.
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
    computeHmac,
    httpGet,
    retryWithBackoff,
} from "@/lib/payments/utils";
import { createHmac } from "crypto";

const STRIPE_BASE = "https://api.stripe.com/v1";

export class StripeProvider implements PaymentProvider {
    readonly name = "STRIPE" as const;

    private secretKey: string;
    private webhookSecret: string;
    private currency: string;
    private environment: "sandbox" | "live";

    constructor(config: ProviderConfig) {
        if (!config.apiKey) throw new Error("Stripe: apiKey (secret key) is required");
        if (!config.webhookSecret) {
            console.warn("[STRIPE] webhookSecret not set — webhook signature verification will reject all events.");
        }
        this.secretKey     = config.apiKey;
        this.webhookSecret = config.webhookSecret ?? "";
        this.currency      = (config as any).currency ?? process.env.STRIPE_CURRENCY ?? "USD";
        this.environment   = config.environment;
    }

    private get headers(): Record<string, string> {
        return {
            "Authorization": `Bearer ${this.secretKey}`,
            "Content-Type":  "application/x-www-form-urlencoded",
            "Stripe-Version": "2024-04-10",
        };
    }

    /** Encode an object as application/x-www-form-urlencoded (Stripe's format) */
    private encodeFormData(obj: Record<string, unknown>, prefix = ""): string {
        return Object.entries(obj)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => {
                const key = prefix ? `${prefix}[${k}]` : k;
                if (typeof v === "object" && !Array.isArray(v)) {
                    return this.encodeFormData(v as Record<string, unknown>, key);
                }
                return `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`;
            })
            .join("&");
    }

    private async stripePost(path: string, params: Record<string, unknown>): Promise<any> {
        const body = this.encodeFormData(params);
        const res = await fetch(`${STRIPE_BASE}${path}`, {
            method:  "POST",
            headers: this.headers,
            body,
        });
        return { ok: res.ok, status: res.status, data: await res.json() };
    }

    // ── Initiate Payment ──────────────────────────────────────────────────────
    // Creates a Stripe Checkout Session. Returns a URL the client redirects to.
    // For ISP use: the frontend opens the URL in a new tab / iframe.

    async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
        // Convert to smallest currency unit (cents for USD, etc.)
        // For TZS (zero-decimal currency), amount is already in the base unit
        const isZeroDecimal = ["TZS", "JPY", "KRW", "VND"].includes(this.currency.toUpperCase());
        const unitAmount = isZeroDecimal
            ? Math.round(request.amount)
            : Math.round(request.amount * 100);

        const params: Record<string, unknown> = {
            "payment_method_types[]": "card",
            "line_items[0][price_data][currency]":            this.currency.toLowerCase(),
            "line_items[0][price_data][unit_amount]":         unitAmount,
            "line_items[0][price_data][product_data][name]":  request.description ?? "ISP Subscription",
            "line_items[0][quantity]":                        1,
            "mode":                   "payment",
            "success_url":            `${request.callbackUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`,
            "cancel_url":             `${request.callbackUrl}?status=cancelled`,
            "client_reference_id":    request.reference,
            "metadata[reference]":    request.reference,
        };

        if (request.buyerEmail) params["customer_email"] = request.buyerEmail;

        try {
            const result = await retryWithBackoff(
                () => this.stripePost("/checkout/sessions", params),
                2
            );
            const data = result.data as Record<string, unknown>;

            if (result.ok && data?.id) {
                return {
                    success:     true,
                    providerRef: data.id as string,
                    message:     "Checkout session created",
                    rawResponse: { sessionId: data.id, url: data.url },
                };
            }

            const err = (data?.error as Record<string, unknown>) ?? {};
            return {
                success:     false,
                message:     (err.message as string) ?? `Stripe error (HTTP ${result.status})`,
                rawResponse: data,
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Network error";
            return { success: false, message: `Stripe error: ${msg}` };
        }
    }

    // ── Check Status ──────────────────────────────────────────────────────────

    async checkStatus(providerRef: string): Promise<TransactionStatus> {
        try {
            // providerRef could be a checkout session ID (cs_...) or payment intent (pi_...)
            const path = providerRef.startsWith("pi_")
                ? `/payment_intents/${providerRef}`
                : `/checkout/sessions/${providerRef}`;

            const result = await httpGet(`${STRIPE_BASE}${path}`, this.headers);
            const data   = result.data as Record<string, unknown>;

            // Checkout session: payment_status ∈ { paid, unpaid, no_payment_required }
            // Payment intent:   status ∈ { succeeded, requires_payment_method, ... }
            const payStatus = (data?.payment_status ?? data?.status ?? "") as string;

            let status: TransactionStatus["status"] = "PENDING";
            if (payStatus === "paid" || payStatus === "succeeded") {
                status = "COMPLETED";
            } else if (["canceled", "requires_payment_method"].includes(payStatus)) {
                status = "FAILED";
            }

            return {
                status,
                providerRef: (data?.payment_intent as string) ?? providerRef,
                amount:      data?.amount_total ? Number(data.amount_total) : undefined,
                rawResponse: data,
            };
        } catch (e: unknown) {
            console.error("[STRIPE] checkStatus error:", e);
            return { status: "PENDING" };
        }
    }

    // ── Webhook Verification ──────────────────────────────────────────────────
    // Stripe uses a t= timestamp + v1= HMAC-SHA256 scheme to prevent replay attacks.

    async verifyWebhook(
        headers: Record<string, string | string[] | undefined>,
        rawBody: string
    ): Promise<WebhookVerification> {
        if (!this.webhookSecret) {
            console.error("[STRIPE] webhookSecret not configured — rejecting webhook.");
            return { verified: false, reason: "Webhook secret not configured" };
        }

        const sig = headers["stripe-signature"] as string | undefined;
        if (!sig) return { verified: false, reason: "Missing stripe-signature header" };

        // Parse: t=<timestamp>,v1=<signature>[,v0=<old_sig>]
        const parts = Object.fromEntries(
            sig.split(",").map(p => p.split("=") as [string, string])
        );
        const timestamp = parts["t"];
        const v1Sig     = parts["v1"];

        if (!timestamp || !v1Sig) {
            return { verified: false, reason: "Malformed stripe-signature header" };
        }

        // Replay attack protection: reject events older than 5 minutes
        const tolerance = 5 * 60; // 300 seconds
        if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) {
            return { verified: false, reason: "Webhook timestamp too old (replay attack protection)" };
        }

        const signedPayload  = `${timestamp}.${rawBody}`;
        const expectedSig    = createHmac("sha256", this.webhookSecret)
            .update(signedPayload, "utf8")
            .digest("hex");

        const valid = timingSafeEqual(v1Sig, expectedSig);
        return { verified: valid, reason: valid ? undefined : "HMAC signature mismatch" };
    }

    // ── Parse Webhook Payload ─────────────────────────────────────────────────

    parseWebhookPayload(body: unknown): ParsedWebhookPayload {
        const event = body as Record<string, unknown>;
        const obj   = (event?.data as Record<string, unknown>)?.object as Record<string, unknown> ?? {};

        // Stripe event types we care about:
        // checkout.session.completed → payment successful
        // payment_intent.payment_failed / checkout.session.expired → failed
        const eventType = (event?.type as string) ?? "";
        const succeeded =
            eventType === "checkout.session.completed" ||
            eventType === "payment_intent.succeeded"   ||
            (obj?.payment_status as string) === "paid" ||
            (obj?.status as string) === "succeeded";

        const resultCode = succeeded ? "0" : "1";

        // reference is in client_reference_id (checkout session) or metadata.reference
        const transactionRef =
            (obj?.client_reference_id as string) ??
            ((obj?.metadata as Record<string, unknown>)?.reference as string) ??
            "";

        return {
            transactionRef,
            providerRef:   (obj?.payment_intent as string) ?? (obj?.id as string) ?? undefined,
            resultCode,
            resultMessage: eventType,
            amount:        obj?.amount_total ? Number(obj.amount_total) : undefined,
            rawBody:       body,
        };
    }
}
