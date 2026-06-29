import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

/**
 * Provider connectivity test metadata.
 *
 * Auth headers verified against official documentation (2026-06-30):
 *
 *   PalmPesa  — Authorization: Bearer <apiKey>
 *     Base: https://palmpesa.drmlelwa.co.tz
 *     Test: POST /api/order-status  { order_id: "test-ping" }
 *     Source: https://documentation.palmpesa.co.tz
 *
 *   ZenoPay   — x-api-key: <apiKey>
 *     Base: https://zenoapi.com/api/payments
 *     Test: GET /order-status?order_id=test-ping
 *     Source: github.com/ZenoPay/zenopay-php
 *
 *   Mongike   — x-api-key: <apiKey>  (no x-api-secret per official OpenAPI spec)
 *     Base: https://mongike.com/api/v1
 *     Test: GET /wallet/history  (returns 401 if wrong key = server alive)
 *     Source: https://mongike.docs.buildwithfern.com/
 *
 *   HarakaPay — X-API-Key: <apiKey>  (capital K, no secret per official docs)
 *     Base: https://harakapay.net
 *     Test: GET /api/v1/balance
 *     Source: https://harakapay.net/api/docs
 */
const PROVIDER_DEFAULTS: Record<
  string,
  {
    envKey:            string;
    defaultUrl:        string;
    testPath:          string;
    testMethod:        string;
    allow404AsReachable: boolean;
    allow401AsReachable: boolean;
  }
> = {
  PALMPESA: {
    envKey:              "PALMPESA_API_URL",
    defaultUrl:          "https://palmpesa.drmlelwa.co.tz",
    testPath:            "/api/order-status",
    testMethod:          "POST",
    allow404AsReachable: true,
    allow401AsReachable: true,
  },
  ZENOPAY: {
    envKey:              "ZENOPAY_API_URL",
    defaultUrl:          "https://zenoapi.com/api/payments",
    testPath:            "/order-status?order_id=test-ping",
    testMethod:          "GET",
    allow404AsReachable: true,
    allow401AsReachable: true,
  },
  MONGIKE: {
    envKey:              "MONGIKE_API_URL",
    defaultUrl:          "https://mongike.com/api/v1",
    // /wallet/history requires Authorization: Bearer token (different from x-api-key).
    // A 401 here confirms the server is alive; credentials are the separate payment apiKey.
    testPath:            "/wallet/history",
    testMethod:          "GET",
    allow404AsReachable: false,
    allow401AsReachable: true,   // 401 expected — different auth scheme for wallet endpoints
  },
  HARAKAPAY: {
    envKey:              "HARAKAPAY_API_URL",
    defaultUrl:          "https://harakapay.net",
    testPath:            "/api/v1/balance",
    testMethod:          "GET",
    allow404AsReachable: false,
    allow401AsReachable: true,
  },
};

function normalizeUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * POST /api/payment-channels/test-api
 *
 * Validates that the given payment gateway API credentials & base URL
 * are reachable before saving. Returns success/failure without storing anything.
 *
 * Body: { provider: string; apiKey: string; apiUrl?: string; apiSecret?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const guard = requirePermission(req, "payment-channels:write");
    if (guard.error) return guard.error;

    const body = await req.json();
    const { provider, apiKey, apiUrl } = body as {
      provider:    string;
      apiKey:      string;
      apiUrl?:     string;
      apiSecret?:  string;
    };

    if (!provider || !apiKey) {
      return errorResponse("provider and apiKey are required", 400);
    }

    const providerUpper = provider.toUpperCase();
    const meta = PROVIDER_DEFAULTS[providerUpper];

    if (!meta) {
      return errorResponse(`Unsupported provider: ${provider}`, 400);
    }

    const baseUrl = (apiUrl || process.env[meta.envKey] || meta.defaultUrl).replace(/\/$/, "");

    // Build auth headers strictly per official docs — no undocumented headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept":       "application/json",
    };

    switch (providerUpper) {
      case "PALMPESA":
        // Official docs: Authorization: Bearer <token>
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;

      case "ZENOPAY":
        // Official docs: x-api-key header
        headers["x-api-key"] = apiKey;
        break;

      case "HARAKAPAY":
        // Official docs (https://harakapay.net/api/docs): X-API-Key (capital K)
        // Single key only — no X-Api-Secret per official docs.
        headers["X-API-Key"] = apiKey;
        break;

      case "MONGIKE":
        // Official docs (https://mongike.docs.buildwithfern.com/): x-api-key only.
        // No x-api-secret header in the official OpenAPI spec.
        headers["x-api-key"] = apiKey;
        break;
    }

    const testUrl = normalizeUrl(baseUrl, meta.testPath);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeoutHandle = setTimeout(() => controller.abort(), 10_000);

      const fetchOpts: RequestInit = {
        method:  meta.testMethod,
        headers,
        signal:  controller.signal,
      };

      // PalmPesa order-status is a POST — send minimal body with dummy order_id
      if (meta.testMethod === "POST" && providerUpper === "PALMPESA") {
        fetchOpts.body = JSON.stringify({ order_id: "test-connectivity-check" });
      }

      const res = await fetch(testUrl, fetchOpts);
      clearTimeout(timeoutHandle);

      const statusCode = res.status;
      const text = await res.text().catch(() => "");
      let responseMessage = "";
      try {
        const json = JSON.parse(text);
        responseMessage = (json?.message ?? json?.error ?? json?.detail ?? "").toString();
      } catch {
        responseMessage = text.slice(0, 200);
      }

      const isSuccess      = statusCode >= 200 && statusCode < 300;
      const isAuthIssue    = statusCode === 401 || statusCode === 403;
      const isNotFound     = statusCode === 404;

      if (isSuccess) {
        return jsonResponse({
          success:   true,
          reachable: true,
          statusCode,
          provider:  providerUpper,
          baseUrl,
          testedUrl: testUrl,
          message:   `✅ ${providerUpper} API is reachable and responding at ${testUrl} (HTTP ${statusCode}).${responseMessage ? ` ${responseMessage}` : ""}`,
        });
      }

      if (isAuthIssue && meta.allow401AsReachable) {
        return jsonResponse({
          success:   true,
          reachable: true,
          statusCode,
          provider:  providerUpper,
          baseUrl,
          testedUrl: testUrl,
          message:   `✅ ${providerUpper} server is reachable at ${testUrl} (HTTP ${statusCode} — server alive, verify your API credentials in the dashboard).`,
        });
      }

      if (isNotFound && meta.allow404AsReachable) {
        return jsonResponse({
          success:   true,
          reachable: true,
          statusCode,
          provider:  providerUpper,
          baseUrl,
          testedUrl: testUrl,
          message:   `✅ ${providerUpper} API is reachable at ${testUrl} — HTTP 404 for test reference is expected (connectivity confirmed).`,
        });
      }

      return jsonResponse({
        success:   false,
        reachable: statusCode < 600,
        statusCode,
        provider:  providerUpper,
        baseUrl,
        testedUrl: testUrl,
        message:   `⚠️ ${providerUpper} responded with HTTP ${statusCode}. ${responseMessage || "Please check your API key or URL."}`,
      });

    } catch (fetchErr: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const isTimeout = fetchErr?.name === "AbortError";
      return jsonResponse({
        success:   false,
        reachable: false,
        statusCode: 0,
        provider:  providerUpper,
        baseUrl,
        testedUrl: testUrl,
        message:   isTimeout
          ? `⏱️ Request timed out (10s) checking ${testUrl}. Verify ${baseUrl} is publicly reachable from this server.`
          : `❌ Cannot reach ${testUrl}: ${fetchErr?.message ?? "Network error"}. Please verify the Base URL.`,
      });
    }

  } catch (e: any) {
    console.error("[test-api] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
