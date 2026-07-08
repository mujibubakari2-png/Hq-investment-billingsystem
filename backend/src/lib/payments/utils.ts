/**
 * Payment Architecture – Shared Utilities
 * Reusable helpers for all payment providers.
 */

import crypto from "crypto";
import { env } from "@/lib/env";
import logger from "@/lib/logger";

// ─── Phone Number Formatting ──────────────────────────────────────────────────

/**
 * Normalize a Tanzanian phone number to E.164 format (255XXXXXXXXX).
 * Handles: 0XXXXXXXXX, +255XXXXXXXXX, 255XXXXXXXXX
 */
export function formatPhoneTZ(phone: string): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("255") && digits.length === 12) {
    return digits; // Already correct
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return "255" + digits.slice(1);
  }
  if (digits.length === 9) {
    return "255" + digits;
  }
  // Fallback: prepend 255 if not already
  if (!digits.startsWith("255")) {
    return "255" + digits;
  }
  return digits;
}

/**
 * Format phone without country code (0XXXXXXXXX) for providers that want local format.
 */
export function formatPhoneLocal(phone: string): string {
  const e164 = formatPhoneTZ(phone);
  // Convert 255XXXXXXXXX → 0XXXXXXXXX
  return "0" + e164.slice(3);
}

// ─── Transaction Reference ────────────────────────────────────────────────────

/**
 * Generate a unique transaction reference.
 * e.g. HP-A1B2C3D4E5F6 or PP-A1B2C3D4E5F6
 */
export function generateReference(prefix: string = "TX"): string {
  const rand = crypto.randomBytes(8).toString("hex").toUpperCase();
  return `${prefix}-${rand}`;
}

// ─── Amount Validation ────────────────────────────────────────────────────────

/** Minimum payment amount in TZS */
const MIN_AMOUNT_TZS = 100;
/** Maximum payment amount in TZS */
const MAX_AMOUNT_TZS = 10_000_000;

export function isValidAmount(amount: number): boolean {
  return (
    typeof amount === "number" &&
    !isNaN(amount) &&
    amount >= MIN_AMOUNT_TZS &&
    amount <= MAX_AMOUNT_TZS
  );
}

// ─── Callback URL Builder ─────────────────────────────────────────────────────

/**
 * Build the full webhook callback URL for a provider.
 * Uses APP_URL env var (must be a publicly reachable URL).
 */
export function buildCallbackUrl(provider: string, req?: Request, baseUrl?: string): string {
  // E04 FIX: Warn in production when APP_URL is not configured.
  // Without it, webhook callbacks fall back to localhost and will never be received.
  if (!env.APP_URL && process.env.NODE_ENV === "production" && !baseUrl) {
    logger.error(
      "[PAYMENT] CRITICAL: APP_URL is not set in production. " +
      "Webhook callback URLs will resolve to http://localhost:3000 and payment confirmations " +
      "will never arrive. Set APP_URL=https://yourdomain.com in your production .env file."
    );
  }

  const requestBase = req
    ? (() => {
      const forwardedProto = req.headers.get("x-forwarded-proto") ?? req.headers.get("x-forwarded-protocol") ?? "http";
      const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
      const host = forwardedHost.split(",")[0]?.trim();
      const proto = forwardedProto.split(",")[0]?.trim() || "http";

      if (!host) return undefined;
      const hostIsLocal = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
      return hostIsLocal ? undefined : `${proto}://${host}`;
    })()
    : undefined;

  const base = requestBase ?? baseUrl ?? env.APP_URL ?? (() => {
    if (req) {
      const host = req.headers.get("host") || "localhost:3000";
      const proto = req.headers.get("x-forwarded-proto") || "http";
      return `${proto}://${host}`;
    }
    return "http://localhost:3000";
  })();

  return `${String(base).replace(/\/$/, "")}/api/webhooks/${provider.toLowerCase()}`;
}

// ─── HMAC Signature ──────────────────────────────────────────────────────────

/**
 * Compute an HMAC-SHA256 signature.
 */
export function computeHmac(
  secret: string,
  payload: string,
  encoding: "hex" | "base64" = "hex"
): string {
  return crypto.createHmac("sha256", secret).update(payload).digest(encoding);
}

/**
 * Timing-safe comparison of two strings.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Normalize inputs (accept header arrays or undefined)
  const sa = Array.isArray(a) ? String(a[0] ?? '') : String(a ?? '');
  const sb = Array.isArray(b) ? String(b[0] ?? '') : String(b ?? '');
  if (sa.length !== sb.length) return false;
  const bufA = Buffer.from(sa, 'utf8');
  const bufB = Buffer.from(sb, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Normalize a header value from a headers record.
 * Accepts case-insensitive header names and returns the first value
 * when the header is an array. Returns `undefined` if not present.
 */
export function normalizeHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  const val = key ? headers[key] : undefined;
  if (Array.isArray(val)) return String(val[0] ?? undefined) || undefined;
  if (typeof val === "string") return val || undefined;
  return undefined;
}

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

/**
 * Retry an async function with exponential backoff.
 * @param fn       - The async function to retry
 * @param retries  - Number of retries (default: 3)
 * @param delay    - Initial delay in ms (default: 500)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, attempt))
        );
      }
    }
  }
  throw lastError;
}

// ─── Idempotency ─────────────────────────────────────────────────────────────

/**
 * Build a deduplication key from provider + reference.
 */
export function buildIdempotencyKey(provider: string, ref: string): string {
  return `${provider.toUpperCase()}:${ref}`;
}

// ─── Safe JSON parse ─────────────────────────────────────────────────────────
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (/authorization/i.test(key) && value) {
      masked[key] = "Bearer [REDACTED]";
    } else if (/secret|token|key/i.test(key) && value) {
      masked[key] = "[REDACTED]";
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * Simple fetch wrapper that throws a descriptive error on non-2xx responses.
 */
export async function httpPost(
  url: string,
  body: Record<string, unknown> | string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  logger.info("[TRACE][httpPost] ENTER", { url, method: "POST", headers: maskHeaders(headers), body });

  const isFormEncoded =
    headers["Content-Type"] === "application/x-www-form-urlencoded";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: isFormEncoded
        ? (body as string)
        : JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[TRACE][httpPost] EXCEPTION", { url, error: message });
    throw new Error(`Network error: ${message}`);
  }

  const responseText = await res.text();
  const contentType = res.headers.get("content-type") || "";
  const trimmedText = responseText.trim();

  let data: unknown = trimmedText;
  if (!trimmedText) {
    data = "";
  } else if (
    contentType.includes("application/json") ||
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[") ||
    trimmedText.startsWith('"')
  ) {
    try {
      data = JSON.parse(trimmedText);
    } catch {
      data = trimmedText;
    }
  }

  logger.info("[TRACE][httpPost] EXIT", { url, status: res.status, data });
  return { ok: res.ok, status: res.status, data };
}

export async function httpGet(
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  logger.info("[TRACE][httpGet] ENTER", { url, method: "GET", headers: maskHeaders(headers) });

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[TRACE][httpGet] EXCEPTION", { url, error: message });
    throw new Error(`Network error: ${message}`);
  }

  const responseText = await res.text();
  const contentType = res.headers.get("content-type") || "";
  const trimmedText = responseText.trim();

  let data: unknown = trimmedText;
  if (!trimmedText) {
    data = "";
  } else if (
    contentType.includes("application/json") ||
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[") ||
    trimmedText.startsWith('"')
  ) {
    try {
      data = JSON.parse(trimmedText);
    } catch {
      data = trimmedText;
    }
  }

  logger.info("[TRACE][httpGet] EXIT", { url, status: res.status, data });
  return { ok: res.ok, status: res.status, data };
}
