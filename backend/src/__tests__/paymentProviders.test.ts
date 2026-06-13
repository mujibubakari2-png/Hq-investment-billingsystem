/**
 * PAY: Unit tests for Stripe and Flutterwave providers
 *
 * Tests cover:
 *  - Successful payment initiation (mocked fetch)
 *  - Failed payment initiation (provider error response)
 *  - Webhook signature verification (valid, invalid, missing header)
 *  - Stripe replay-attack protection (stale timestamp)
 *  - Webhook payload parsing (success and failure events)
 *  - checkStatus mapping to TransactionStatus
 */

import { StripeProvider } from "@/lib/payments/providers/stripe";
import { FlutterwaveProvider } from "@/lib/payments/providers/flutterwave";
import { createHmac } from "crypto";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFetch(response: object, ok = true, status = 200) {
    return jest.fn().mockResolvedValue({
        ok,
        status,
        headers: { get: (key: string) => key.toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => response,
        text: async () => JSON.stringify(response),
    });
}

function stripeSignature(secret: string, body: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signed = `${ts}.${body}`;
    const sig = createHmac("sha256", secret).update(signed, "utf8").digest("hex");
    return `t=${ts},v1=${sig}`;
}

const STRIPE_SECRET  = "sk_test_abc123";
const STRIPE_WSECRET = "whsec_testsecret";
const FLW_SECRET     = "FLWSECK_test_abc";
const FLW_HASH       = "flw-test-hash-value";

// ── Stripe Provider ───────────────────────────────────────────────────────────

describe("StripeProvider", () => {
    let provider: StripeProvider;
    let origFetch: typeof globalThis.fetch;

    beforeAll(() => { origFetch = globalThis.fetch; });
    afterAll(()  => { globalThis.fetch = origFetch; });

    beforeEach(() => {
        provider = new StripeProvider({
            apiKey:        STRIPE_SECRET,
            webhookSecret: STRIPE_WSECRET,
            environment:   "sandbox",
        });
    });

    // ── initiatePayment ───────────────────────────────────────────────────────

    it("returns success when Stripe returns a session id", async () => {
        (globalThis.fetch as any) = makeFetch({ id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" });

        const result = await provider.initiatePayment({
            amount:      50,
            phone:       "255712345678",
            reference:   "TXN-001",
            callbackUrl: "https://example.com/callback",
            buyerEmail:  "test@example.com",
        });

        expect(result.success).toBe(true);
        expect(result.providerRef).toBe("cs_test_abc");
    });

    it("returns failure when Stripe responds with an error", async () => {
        (globalThis.fetch as any) = makeFetch({
            error: { message: "Your card has insufficient funds.", code: "insufficient_funds" }
        }, false, 402);

        const result = await provider.initiatePayment({
            amount: 50, phone: "255712345678", reference: "TXN-002",
            callbackUrl: "https://example.com/callback",
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain("insufficient funds");
    });

    // ── checkStatus ───────────────────────────────────────────────────────────

    it("maps checkout session payment_status=paid to COMPLETED", async () => {
        (globalThis.fetch as any) = makeFetch({
            id: "cs_test_abc", payment_status: "paid", payment_intent: "pi_test_abc",
        });

        const status = await provider.checkStatus("cs_test_abc");
        expect(status.status).toBe("COMPLETED");
        expect(status.providerRef).toBe("pi_test_abc");
    });

    it("maps payment_intent status=succeeded to COMPLETED", async () => {
        (globalThis.fetch as any) = makeFetch({ id: "pi_abc", status: "succeeded" });

        const status = await provider.checkStatus("pi_abc");
        expect(status.status).toBe("COMPLETED");
    });

    it("maps requires_payment_method to FAILED", async () => {
        (globalThis.fetch as any) = makeFetch({ id: "pi_abc", status: "requires_payment_method" });

        const status = await provider.checkStatus("pi_abc");
        expect(status.status).toBe("FAILED");
    });

    // ── verifyWebhook ─────────────────────────────────────────────────────────

    it("accepts a valid stripe-signature", async () => {
        const body = JSON.stringify({ type: "checkout.session.completed" });
        const sig  = stripeSignature(STRIPE_WSECRET, body);

        const result = await provider.verifyWebhook({ "stripe-signature": sig }, body);
        expect(result.verified).toBe(true);
    });

    it("rejects an invalid stripe-signature", async () => {
        const body = JSON.stringify({ type: "checkout.session.completed" });
        const sig  = stripeSignature("wrong-secret", body);

        const result = await provider.verifyWebhook({ "stripe-signature": sig }, body);
        expect(result.verified).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it("rejects a missing stripe-signature header", async () => {
        const result = await provider.verifyWebhook({}, "{}");
        expect(result.verified).toBe(false);
        expect(result.reason).toMatch(/missing/i);
    });

    it("rejects stale timestamp (replay attack protection)", async () => {
        const body      = JSON.stringify({ type: "checkout.session.completed" });
        const staleTs   = Math.floor(Date.now() / 1000) - 400; // > 5 min ago
        const sig       = stripeSignature(STRIPE_WSECRET, body, staleTs);

        const result = await provider.verifyWebhook({ "stripe-signature": sig }, body);
        expect(result.verified).toBe(false);
        expect(result.reason).toMatch(/timestamp/i);
    });

    it("rejects when webhookSecret is not configured", async () => {
        const noSecret = new StripeProvider({ apiKey: STRIPE_SECRET, environment: "sandbox" });
        const result   = await noSecret.verifyWebhook({ "stripe-signature": "t=1,v1=abc" }, "{}");
        expect(result.verified).toBe(false);
    });

    // ── parseWebhookPayload ───────────────────────────────────────────────────

    it("parses checkout.session.completed as resultCode=0", () => {
        const event = {
            type: "checkout.session.completed",
            data: { object: { id: "cs_test", payment_intent: "pi_test", client_reference_id: "TXN-001", payment_status: "paid", amount_total: 5000 } }
        };
        const parsed = provider.parseWebhookPayload(event);
        expect(parsed.resultCode).toBe("0");
        expect(parsed.transactionRef).toBe("TXN-001");
        expect(parsed.providerRef).toBe("pi_test");
    });

    it("parses checkout.session.expired as resultCode=1", () => {
        const event = {
            type: "checkout.session.expired",
            data: { object: { id: "cs_test", client_reference_id: "TXN-002" } }
        };
        const parsed = provider.parseWebhookPayload(event);
        expect(parsed.resultCode).toBe("1");
    });
});

// ── Flutterwave Provider ──────────────────────────────────────────────────────

describe("FlutterwaveProvider", () => {
    let provider: FlutterwaveProvider;
    let origFetch: typeof globalThis.fetch;

    beforeAll(() => { origFetch = globalThis.fetch; });
    afterAll(()  => { globalThis.fetch = origFetch; });

    beforeEach(() => {
        provider = new FlutterwaveProvider({
            apiKey:        FLW_SECRET,
            webhookSecret: FLW_HASH,
            environment:   "sandbox",
        });
    });

    // ── initiatePayment ───────────────────────────────────────────────────────

    it("returns success when Flutterwave returns a payment link", async () => {
        (globalThis.fetch as any) = makeFetch({
            status: "success",
            message: "Hosted Link",
            data: { link: "https://checkout.flutterwave.com/v3/hosted/pay/abc" }
        });

        const result = await provider.initiatePayment({
            amount:      15000,
            phone:       "255712345678",
            reference:   "TXN-FLW-001",
            callbackUrl: "https://example.com/callback",
            buyerName:   "John Doe",
            buyerEmail:  "john@example.com",
        });

        expect(result.success).toBe(true);
        expect(result.providerRef).toBe("TXN-FLW-001");
        expect((result.rawResponse as any)?.link).toContain("flutterwave.com");
    });

    it("returns failure when Flutterwave responds with an error", async () => {
        (globalThis.fetch as any) = makeFetch({ status: "error", message: "Invalid API key" }, false, 401);

        const result = await provider.initiatePayment({
            amount: 100, phone: "255712345678", reference: "TXN-FLW-002",
            callbackUrl: "https://example.com/callback",
        });

        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid API key");
    });

    // ── checkStatus ───────────────────────────────────────────────────────────

    it("maps status=SUCCESSFUL to COMPLETED (numeric id)", async () => {
        (globalThis.fetch as any) = makeFetch({
            status: "success",
            data: { id: 12345, status: "successful", amount: 15000, tx_ref: "TXN-FLW-001" }
        });

        const status = await provider.checkStatus("12345");
        expect(status.status).toBe("COMPLETED");
        expect(status.providerRef).toBe("12345");
    });

    it("maps status=FAILED to FAILED", async () => {
        (globalThis.fetch as any) = makeFetch({
            status: "success",
            data: { id: 99, status: "failed", tx_ref: "TXN-FLW-003" }
        });

        const status = await provider.checkStatus("TXN-FLW-003");
        expect(status.status).toBe("FAILED");
    });

    // ── verifyWebhook ─────────────────────────────────────────────────────────

    it("accepts correct verif-hash", async () => {
        const result = await provider.verifyWebhook({ "verif-hash": FLW_HASH }, "{}");
        expect(result.verified).toBe(true);
    });

    it("rejects wrong verif-hash", async () => {
        const result = await provider.verifyWebhook({ "verif-hash": "wrong-hash" }, "{}");
        expect(result.verified).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it("rejects missing verif-hash header", async () => {
        const result = await provider.verifyWebhook({}, "{}");
        expect(result.verified).toBe(false);
        expect(result.reason).toMatch(/missing/i);
    });

    it("rejects when webhookSecret is not configured", async () => {
        const noSecret = new FlutterwaveProvider({ apiKey: FLW_SECRET, environment: "sandbox" });
        const result   = await noSecret.verifyWebhook({ "verif-hash": "anything" }, "{}");
        expect(result.verified).toBe(false);
    });

    // ── parseWebhookPayload ───────────────────────────────────────────────────

    it("parses charge.completed with status successful as resultCode=0", () => {
        const event = {
            event: "charge.completed",
            data: {
                id: 12345, tx_ref: "TXN-FLW-001", status: "successful",
                amount: 15000, customer: { phone_number: "255712345678" }
            }
        };
        const parsed = provider.parseWebhookPayload(event);
        expect(parsed.resultCode).toBe("0");
        expect(parsed.transactionRef).toBe("TXN-FLW-001");
        expect(parsed.providerRef).toBe("12345");
        expect(parsed.phone).toBe("255712345678");
    });

    it("parses failed charge as resultCode=1", () => {
        const event = {
            event: "charge.failed",
            data: { id: 999, tx_ref: "TXN-FLW-002", status: "failed" }
        };
        const parsed = provider.parseWebhookPayload(event);
        expect(parsed.resultCode).toBe("1");
        expect(parsed.transactionRef).toBe("TXN-FLW-002");
    });
});
