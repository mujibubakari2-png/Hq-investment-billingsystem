/// <reference types="jest" />

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { PalmPesaProvider } from "../lib/payments/providers/palmpesa";
import * as utils from "../lib/payments/utils";

describe("PalmPesaProvider", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it("treats a zero-padded response code as a successful initiation", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: {
                ResponseCode: "00",
                ResponseDescription: "Accepted",
                CheckoutRequestID: "REQ-123",
            },
        });

        const provider = new PalmPesaProvider({
            apiKey: "test-key",
            apiUrl: "https://example.test/api",
            environment: "sandbox",
        });

        const result = await provider.initiatePayment({
            amount: 5000,
            phone: "0712345678",
            reference: "INV-100",
            description: "Test payment",
            callbackUrl: "https://example.test/callback",
        });

        expect(result.success).toBe(true);
        expect(result.providerRef).toBe("REQ-123");
        expect(result.message).toBe("Accepted");
    });

    it("accepts plain-text success responses returned with HTTP 200", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: "SUCCESS",
        });

        const provider = new PalmPesaProvider({
            apiKey: "test-key",
            apiUrl: "https://example.test/api",
            environment: "sandbox",
        });

        const result = await provider.initiatePayment({
            amount: 5000,
            phone: "0712345678",
            reference: "INV-100",
            description: "Test payment",
            callbackUrl: "https://example.test/callback",
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe("SUCCESS");
    });

    it("parses PalmPesa JSON response bodies returned as plain text", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: '{"ResponseCode":"00","ResponseDescription":"Accepted","CheckoutRequestID":"REQ-123"}',
        });

        const provider = new PalmPesaProvider({
            apiKey: "test-key",
            apiUrl: "https://example.test/api",
            environment: "sandbox",
        });

        const result = await provider.initiatePayment({
            amount: 5000,
            phone: "0712345678",
            reference: "INV-100",
            description: "Test payment",
            callbackUrl: "https://example.test/callback",
        });

        expect(result.success).toBe(true);
        expect(result.providerRef).toBe("REQ-123");
        expect(result.message).toBe("Accepted");
    });

    it("treats a 200 response with a generic success message as an accepted initiation", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: { message: "Payment initiated" },
        });

        const provider = new PalmPesaProvider({
            apiKey: "test-key",
            apiUrl: "https://example.test/api",
            environment: "sandbox",
        });

        const result = await provider.initiatePayment({
            amount: 5000,
            phone: "0712345678",
            reference: "INV-100",
            description: "Test payment",
            callbackUrl: "https://example.test/callback",
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe("Payment initiated");
    });

    it("parses stringified JSON from checkStatus responses", async () => {
        jest.spyOn(utils, "httpGet").mockResolvedValue({
            ok: true,
            status: 200,
            data: '{"ResultCode":"0","order_status":"COMPLETED","Amount":5000}',
        });

        const provider = new PalmPesaProvider({
            apiKey: "test-key",
            apiUrl: "https://example.test/api",
            environment: "sandbox",
        });

        const status = await provider.checkStatus("REQ-123");

        expect(status.status).toBe("COMPLETED");
        expect(status.providerRef).toBe("REQ-123");
        expect(status.amount).toBe(5000);
    });

    it("falls back to raw text when a successful HTTP 200 response is not valid JSON", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            text: async () => "Payment initiated",
            json: async () => {
                throw new SyntaxError("Unexpected token");
            },
        } as unknown as Response);

        const result = await utils.httpPost("https://example.test/api/process-payment", { test: true }, { "Content-Type": "application/json" });

        expect(result.ok).toBe(true);
        expect(result.status).toBe(200);
        expect(result.data).toBe("Payment initiated");
    });

    it("uses the request host for callback URLs when APP_URL is localhost", () => {
        const req = new Request("https://example.test/api/license/renew", {
            headers: {
                host: "example.test",
                "x-forwarded-proto": "https",
            },
        });

        const callbackUrl = utils.buildCallbackUrl("PALMPESA", req as unknown as Request, "http://localhost:3000");

        expect(callbackUrl).toBe("https://example.test/api/webhooks/palmpesa");
    });

    it("parses stringified webhook payload bodies", () => {
        const provider = new PalmPesaProvider({
            apiKey: "test-key",
            apiUrl: "https://example.test/api",
            environment: "sandbox",
        });

        const payload = JSON.stringify({
            TransactionId: "TX-123",
            AccountReference: "INV-100",
            Amount: 5000,
            ResultCode: "0",
            ResultDesc: "Payment successful",
        });

        const parsed = provider.parseWebhookPayload(payload);

        expect(parsed.transactionRef).toBe("INV-100");
        expect(parsed.providerRef).toBe("TX-123");
        expect(parsed.resultCode).toBe("0");
        expect(parsed.resultMessage).toBe("Payment successful");
        expect(parsed.amount).toBe(5000);
    });
});
