/**
 * Payment Architecture – Shared Utilities
 * Reusable helpers for all payment providers.
 */

import crypto from "crypto";
import { env } from "@/lib/env";

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
export function buildCallbackUrl(provider: string, req?: Request): string {
  const base =
    env.APP_URL ||
    (() => {
      if (req) {
        const host = req.headers.get("host") || "localhost:3001";
        const proto = req.headers.get("x-forwarded-proto") || "http";
        return `${proto}://${host}`;
      }
      return "http://localhost:3001";
    })();

  return `${base}/api/webhooks/${provider.toLowerCase()}`;
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
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
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

/**
 * Simple fetch wrapper that throws a descriptive error on non-2xx responses.
 */
export async function httpPost(
  url: string,
  body: Record<string, unknown> | string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const isFormEncoded =
    headers["Content-Type"] === "application/x-www-form-urlencoded";

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: isFormEncoded
      ? (body as string)
      : JSON.stringify(body),
  });

  let data: unknown;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { ok: res.ok, status: res.status, data };
}

export async function httpGet(
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url, { method: "GET", headers });

  let data: unknown;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { ok: res.ok, status: res.status, data };
}
