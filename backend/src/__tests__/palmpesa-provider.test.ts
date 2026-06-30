/// <reference types="jest" />

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { PalmPesaProvider } from "../lib/payments/providers/palmpesa";
import * as utils from "../lib/payments/utils";

describe("PalmPesaProvider", () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it("accepts the official Endpoint 02 initiation response", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: {
                message: "Payment initiated. Processing will continue asynchronously.",
                order_id: "PALMPESA17682869972044",
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
        expect(result.providerRef).toBe("PALMPESA17682869972044");
        expect(result.message).toBe("Payment initiated. Processing will continue asynchronously.");
    });

    it("rejects successful-looking HTTP 200 responses that have no order_id", async () => {
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

        expect(result.success).toBe(false);
        expect(result.message).toBe("PalmPesa error (HTTP 200)");
    });

    it("parses PalmPesa JSON response bodies returned as plain text", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: '{"message":"Payment initiated. Processing will continue asynchronously.","order_id":"PALMPESA17682869972044"}',
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
        expect(result.providerRef).toBe("PALMPESA17682869972044");
        expect(result.message).toBe("Payment initiated. Processing will continue asynchronously.");
    });

    it("does not accept an initiation response without PalmPesa order_id", async () => {
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

        expect(result.success).toBe(false);
        expect(result.message).toBe("Payment initiated");
    });

    it("parses stringified JSON from checkStatus responses", async () => {
        jest.spyOn(utils, "httpPost").mockResolvedValue({
            ok: true,
            status: 200,
            data: '{"reference":"0927530628","resultcode":"000","result":"SUCCESS","message":"Order fetch successful","data":[{"order_id":"REQ-123","amount":"5000","payment_status":"COMPLETED","transid":"805613901007"}]}',
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
            order_id: "PALMPESA17683440586334",
            payment_status: "COMPLETED",
        });

        const parsed = provider.parseWebhookPayload(payload);

        expect(parsed.transactionRef).toBe("PALMPESA17683440586334");
        expect(parsed.providerRef).toBe("PALMPESA17683440586334");
        expect(parsed.resultCode).toBe("0");
        expect(parsed.resultMessage).toBe("COMPLETED");
    });
});
