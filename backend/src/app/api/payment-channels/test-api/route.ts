import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

// Supported providers and their default base URLs (from env or fallback)
const PROVIDER_DEFAULTS: Record<string, { envKey: string; defaultUrl: string; testPath: string }> = {
    ZENOPAY: {
        envKey: "ZENOPAY_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
    },
    PALMPESA: {
        envKey: "PALMPESA_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
    },
    HARAKAPAY: {
        envKey: "HARAKAPAY_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
    },
    MONGIKE: {
        envKey: "MONGIKE_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
    },
};

/**
 * POST /api/payment-channels/test-api
 *
 * Validates that the given payment gateway API credentials & base URL
 * are reachable before saving. Returns success/failure without storing anything.
 *
 * Body: { provider: string; apiKey: string; apiUrl: string; apiSecret?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "payment-channels:write");
        if (guard.error) return guard.error;

        const body = await req.json();
        const { provider, apiKey, apiUrl, apiSecret } = body as {
            provider: string;
            apiKey: string;
            apiUrl: string;
            apiSecret?: string;
        };

        if (!provider || !apiKey) {
            return errorResponse("provider and apiKey are required", 400);
        }

        const providerUpper = provider.toUpperCase();
        const meta = PROVIDER_DEFAULTS[providerUpper];

        if (!meta) {
            return errorResponse(`Unsupported provider: ${provider}`, 400);
        }

        // Use provided URL or fall back to env/default
        const baseUrl = (apiUrl || process.env[meta.envKey] || meta.defaultUrl).replace(/\/$/, "");

        // Build auth headers per provider
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        switch (providerUpper) {
            case "ZENOPAY":
                headers["x-api-key"] = apiKey;
                break;
            case "PALMPESA":
                headers["Authorization"] = `Bearer ${apiKey}`;
                break;
            case "HARAKAPAY":
                headers["X-Api-Key"] = apiKey;
                if (apiSecret) headers["X-Api-Secret"] = apiSecret;
                break;
            case "MONGIKE":
                headers["x-api-key"] = apiKey;
                if (apiSecret) headers["x-api-secret"] = apiSecret;
                break;
        }

        // Attempt a lightweight GET to the base URL to check reachability
        // We use a status endpoint — a 401/403 means the server IS reachable (just wrong key),
        // a 200 or 4xx from the server means the URL is valid.
        // Network errors (ECONNREFUSED, DNS failure) mean the URL is wrong.
        const testUrl = `${baseUrl}${meta.testPath}`;

        let reachable = false;
        let statusCode = 0;
        let responseMessage = "";

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(testUrl, {
                method: "GET",
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeout);
            statusCode = res.status;

            // 200-299 = valid key, 400-403 = server reachable (key may be wrong),
            // 404 = server reachable but path not found (still OK for URL check),
            // 5xx = server error but reachable
            reachable = statusCode < 600;

            const text = await res.text().catch(() => "");
            try {
                const json = JSON.parse(text);
                responseMessage = (json?.message ?? json?.error ?? json?.detail ?? "").toString();
            } catch {
                responseMessage = text.slice(0, 200);
            }

            // Consider 200-299 or 401/403 (auth error = server is real) as "API key recognized"
            const apiValid = (statusCode >= 200 && statusCode < 300) || statusCode === 401 || statusCode === 403;

            return jsonResponse({
                success: apiValid,
                reachable,
                statusCode,
                provider: providerUpper,
                baseUrl,
                message: apiValid
                    ? `✅ ${providerUpper} API is reachable (HTTP ${statusCode}). Credentials look valid.`
                    : `⚠️ ${providerUpper} server responded with HTTP ${statusCode}. ${responseMessage || "Please check your API key."}`,
            });

        } catch (fetchErr: any) {
            const isTimeout = fetchErr?.name === "AbortError";
            return jsonResponse({
                success: false,
                reachable: false,
                statusCode: 0,
                provider: providerUpper,
                baseUrl,
                message: isTimeout
                    ? `⏱️ Request timed out (8s). Check that ${baseUrl} is accessible from this server.`
                    : `❌ Cannot reach ${baseUrl}. Error: ${fetchErr?.message || "Network error"}. Please verify the Base URL.`,
            });
        }

    } catch (e: any) {
        console.error("test-api endpoint error:", e);
        return errorResponse("Internal server error", 500);
    }
}
