import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

// Supported providers and their default base URLs (from env or fallback)
const PROVIDER_DEFAULTS: Record<string, { envKey: string; defaultUrl: string; testPath: string; allow404AsReachable: boolean }> = {
    ZENOPAY: {
        envKey: "ZENOPAY_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
        allow404AsReachable: true,
    },
    PALMPESA: {
        envKey: "PALMPESA_API_URL",
        defaultUrl: "",
        testPath: "/order-status?order_id=test-ping",
        allow404AsReachable: true,
    },
    HARAKAPAY: {
        envKey: "HARAKAPAY_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
        allow404AsReachable: true,
    },
    MONGIKE: {
        envKey: "MONGIKE_API_URL",
        defaultUrl: "",
        testPath: "/payments/status/test-ping",
        allow404AsReachable: true,
    },
};

export function normalizeUrl(baseUrl: string, path: string): string {
    const cleanedBase = baseUrl.replace(/\/+$/, "");
    let cleanedPath = path.replace(/^\/+/, "");

    if (cleanedBase.toLowerCase().endsWith("/api") && cleanedPath.toLowerCase().startsWith("api/")) {
        cleanedPath = cleanedPath.replace(/^api\//i, "");
    }

    return `${cleanedBase}/${cleanedPath}`;
}

export function getTestUrls(baseUrl: string, path: string): string[] {
    const cleanedBase = baseUrl.replace(/\/+$/, "");
    const primaryUrl = normalizeUrl(cleanedBase, path);
    const urls = [primaryUrl];
    const pathHasApiPrefix = path.toLowerCase().startsWith("/api/");
    const baseEndsWithApi = cleanedBase.toLowerCase().endsWith("/api");

    if (!baseEndsWithApi && !pathHasApiPrefix) {
        urls.push(normalizeUrl(`${cleanedBase}/api`, path));
    }

    return [...new Set(urls)];
}

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

        // Attempt lightweight GETs to verify the gateway endpoint.
        // We test both the configured base URL and an /api-prefixed fallback.
        const candidateUrls = getTestUrls(baseUrl, meta.testPath);

        let reachable = false;
        let statusCode = 0;
        let responseMessage = "";
        let lastSuccessMessage = "";

        for (const testUrl of candidateUrls) {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
                const controller = new AbortController();
                timeout = setTimeout(() => controller.abort(), 8000);

                const res = await fetch(testUrl, {
                    method: "GET",
                    headers,
                    signal: controller.signal,
                });

                clearTimeout(timeout);
                statusCode = res.status;
                reachable = statusCode < 600;

                const text = await res.text().catch(() => "");
                try {
                    const json = JSON.parse(text);
                    responseMessage = (json?.message ?? json?.error ?? json?.detail ?? "").toString();
                } catch {
                    responseMessage = text.slice(0, 200);
                }

                const apiValid = (statusCode >= 200 && statusCode < 300) || statusCode === 401 || statusCode === 403;
                const notFound = statusCode === 404;

                if (apiValid) {
                    lastSuccessMessage = `✅ ${providerUpper} API is reachable at ${testUrl} (HTTP ${statusCode}). Credentials appear valid.`;
                    return jsonResponse({
                        success: true,
                        reachable,
                        statusCode,
                        provider: providerUpper,
                        baseUrl,
                        testedUrl: testUrl,
                        message: lastSuccessMessage,
                    });
                }

                if (notFound && meta.allow404AsReachable) {
                    lastSuccessMessage = `✅ ${providerUpper} API is reachable at ${testUrl}, but the specific test resource returned HTTP 404. This usually means the provider returned "not found" for a dummy transaction reference, which is expected for connectivity checks.`;
                    return jsonResponse({
                        success: true,
                        reachable,
                        statusCode,
                        provider: providerUpper,
                        baseUrl,
                        testedUrl: testUrl,
                        message: lastSuccessMessage,
                    });
                }

                // Keep the last 404 or other reachable response and continue trying fallback URLs.
                if (statusCode === 404) {
                    lastSuccessMessage = `⚠️ ${providerUpper} endpoint not found at ${testUrl} (HTTP 404). Trying alternative URL.`;
                    continue;
                }

                return jsonResponse({
                    success: false,
                    reachable,
                    statusCode,
                    provider: providerUpper,
                    baseUrl,
                    testedUrl: testUrl,
                    message: `⚠️ ${providerUpper} server responded with HTTP ${statusCode}. ${responseMessage || "Please check your API key or URL."}`,
                });

            } catch (fetchErr: any) {
                if (timeout) clearTimeout(timeout);
                const isTimeout = fetchErr?.name === "AbortError";
                lastSuccessMessage = isTimeout
                    ? `⏱️ Request timed out (8s) while checking ${testUrl}. Verify that ${baseUrl} is reachable from this server.`
                    : `❌ Cannot reach ${testUrl}. Error: ${fetchErr?.message || "Network error"}. Please verify the Base URL.`;
                continue;
            }
        }

        return jsonResponse({
            success: false,
            reachable,
            statusCode,
            provider: providerUpper,
            baseUrl,
            testedUrl: candidateUrls.join(', '),
            message: lastSuccessMessage || `❌ ${providerUpper} API check failed for ${baseUrl}. Please verify the URL and credentials.`,
        });

    } catch (e: any) {
        console.error("test-api endpoint error:", e);
        return errorResponse("Internal server error", 500);
    }
}
