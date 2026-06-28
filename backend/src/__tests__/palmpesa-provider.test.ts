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
});
