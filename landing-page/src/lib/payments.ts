import crypto from "crypto";

export interface MobilePaymentRequest {
  provider: string; // e.g., "ZENOPAY", "MONGIKE", "HARAKAPAY", "PALMPESA"
  apiKey: string;
  apiUrl?: string;
  reference: string;
  amount: number;
  phone: string;
  buyerName?: string;
  buyerEmail?: string;
  webhookUrl: string;
}

// Utility to format phone numbers
function formatPhoneLocal(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) {
    return "0" + digits.substring(3);
  }
  return digits;
}

function formatPhoneTZ(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return "255" + digits.substring(1);
  }
  return digits;
}

export async function initiateEcomMobilePayment(req: MobilePaymentRequest) {
  const { provider, apiKey, apiUrl, reference, amount, phone, buyerName, buyerEmail, webhookUrl } = req;
  
  const amountRounded = Math.round(amount);
  const localPhone = formatPhoneLocal(phone);
  const intlPhone = formatPhoneTZ(phone);
  
  if (provider === "ZENOPAY") {
    const url = (apiUrl || "https://zenoapi.com/api/payments").replace(/\/$/, "");
    const payload = {
      order_id: reference,
      amount: amountRounded,
      buyer_name: buyerName || "Customer",
      buyer_phone: localPhone,
      buyer_email: buyerEmail || "",
      webhook_url: webhookUrl,
    };
    const res = await fetch(`${url}/mobile_money_tanzania`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || (data.status && data.status !== "success")) {
      throw new Error(`ZenoPay Error: ${data.message || JSON.stringify(data)}`);
    }
    return data;
  }
  
  if (provider === "MONGIKE") {
    const url = (apiUrl || "https://mongike.com/api/v1").replace(/\/$/, "");
    const payload = {
      order_id: reference,
      amount: amountRounded,
      buyer_phone: intlPhone,
      fee_payer: "MERCHANT",
      webhook_url: webhookUrl,
    };
    const res = await fetch(`${url}/payments/mobile-money/tanzania`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || (data.status && data.status !== "success")) {
      throw new Error(`Mongike Error: ${data.message || JSON.stringify(data)}`);
    }
    return data;
  }
  
  if (provider === "HARAKAPAY") {
    const url = (apiUrl || "https://harakapay.net").replace(/\/$/, "");
    const payload = {
      phone: localPhone,
      amount: amountRounded,
      description: `Ecom Order ${reference}`,
      webhook_url: webhookUrl,
    };
    const res = await fetch(`${url}/api/v1/collect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    // Assuming 2xx is success
    if (!res.ok) {
      throw new Error(`HarakaPay Error: ${data.message || JSON.stringify(data)}`);
    }
    return data;
  }
  
  if (provider === "PALMPESA") {
    const url = (apiUrl || "https://palmpesa.drmlelwa.co.tz").replace(/\/$/, "");
    const payload = {
      name: buyerName || "Customer",
      email: buyerEmail || "",
      phone: localPhone,
      amount: amountRounded,
      transaction_id: reference,
      address: "Tanzania",
      postcode: "00000",
      callback_url: webhookUrl,
    };
    const res = await fetch(`${url}/api/palmpesa/initiate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`PalmPesa Error: ${data.message || JSON.stringify(data)}`);
    }
    return data;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

// Utility to verify webhook signatures using timing-safe equal
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
