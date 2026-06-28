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
