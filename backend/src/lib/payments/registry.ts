/**
 * Payment Provider Registry
 *
 * Factory that resolves the correct provider by name, injecting config
 * either from the PaymentChannel DB record or from environment variables.
 */

import { PaymentProvider, ProviderName, ProviderConfig } from "@/lib/payments/types";
import { PalmPesaProvider }    from "@/lib/payments/providers/palmpesa";
import { ZenoPayProvider }     from "@/lib/payments/providers/zenopay";
import { MongikeProvider }     from "@/lib/payments/providers/mongike";
import { HarakaPayProvider }   from "@/lib/payments/providers/harakapay";
import { StripeProvider }      from "@/lib/payments/providers/stripe";
import { FlutterwaveProvider } from "@/lib/payments/providers/flutterwave";
// E11 FIX: Removed MPESA

import { env } from "@/lib/env";
// CRED-001 FIX: Import decrypt so DB-stored credentials are decrypted before being
// handed to provider instances. Without this, providers receive raw "enc:v1:..." strings
// as their API keys and every payment call fails with an auth/invalid-key error.
import { decrypt } from "@/lib/encryption";

// ─── Build ProviderConfig from environment variables (fallback) ───────────────

function envConfigFor(provider: ProviderName): ProviderConfig {
  const environment = (env.PAYMENT_ENVIRONMENT ?? "sandbox") as "sandbox" | "live";

  // E03 FIX: Alert loudly in production when payment gateway is still in sandbox mode.
  // Real money transactions will fail silently or go to a test bucket if this is left as 'sandbox'.
  if (process.env.NODE_ENV === "production" && environment === "sandbox") {
    console.error(
      "[PAYMENT] CRITICAL: PAYMENT_ENVIRONMENT=sandbox in a production environment! " +
      "Real payments will be routed to the test gateway — money will NOT be credited. " +
      "Set PAYMENT_ENVIRONMENT=live in your production .env file and restart the server."
    );
  }

  switch (provider) {
    case "PALMPESA":
      return {
        apiKey: env.PALMPESA_API_KEY,
        apiUrl: env.PALMPESA_API_URL,
        webhookSecret: env.PALMPESA_WEBHOOK_SECRET,
        environment,
      };
    case "ZENOPAY":
      return {
        apiKey: env.ZENOPAY_API_KEY,
        accountId: env.ZENOPAY_ACCOUNT_ID,
        apiUrl: env.ZENOPAY_API_URL,
        webhookSecret: env.ZENOPAY_WEBHOOK_SECRET,
        environment,
      };
    case "MONGIKE":
      return {
        apiKey: env.MONGIKE_API_KEY,
        apiSecret: env.MONGIKE_API_SECRET,
        apiUrl: env.MONGIKE_API_URL,
        webhookSecret: env.MONGIKE_WEBHOOK_SECRET,
        environment,
      };
    case "HARAKAPAY":
      return {
        apiKey: env.HARAKAPAY_API_KEY,
        apiSecret: env.HARAKAPAY_API_SECRET,
        apiUrl: env.HARAKAPAY_API_URL,
        webhookSecret: env.HARAKAPAY_WEBHOOK_SECRET,
        environment,
      };
    case "STRIPE":
      return {
        apiKey:        process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        environment,
      };
    case "FLUTTERWAVE":
      return {
        apiKey:        process.env.FLUTTERWAVE_SECRET_KEY,
        webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_HASH,
        apiUrl:        process.env.FLUTTERWAVE_API_URL,
        environment,
      };
  }
}

// ─── Build ProviderConfig from a PaymentChannel DB record ────────────────────

export interface ChannelRecord {
  provider: string;
  apiKey?: string | null;
  apiSecret?: string | null;
  webhookSecret?: string | null;
  environment?: string | null;
  config?: unknown;
}

/**
 * CRED-001 FIX: Decrypt sensitive channel fields before building ProviderConfig.
 *
 * PaymentChannel rows store apiKey / apiSecret / webhookSecret encrypted as
 * "enc:v1:<iv>:<tag>:<ciphertext>" strings (written by encryptPaymentChannelFields).
 * Previously these were passed raw to provider instances, causing every API call to
 * be rejected by the payment gateway because the key was an unreadable cipher string.
 *
 * decrypt() is idempotent — plaintext (unencrypted legacy rows) pass through unchanged.
 */
function channelToConfig(channel: ChannelRecord): ProviderConfig {
  const cfg = (channel.config ?? {}) as Record<string, unknown>;
  const environment = (channel.environment ?? env.PAYMENT_ENVIRONMENT ?? "sandbox") as
    | "sandbox"
    | "live";

  // Decrypt each sensitive field; decrypt() returns null for null/undefined inputs,
  // so we coerce null → undefined to satisfy ProviderConfig (optional fields).
  const apiKey       = decrypt(channel.apiKey)       ?? decrypt(cfg.apiKey as string | null)       ?? undefined;
  const apiSecret    = decrypt(channel.apiSecret)    ?? decrypt(cfg.apiSecret as string | null)    ?? undefined;
  const webhookSecret= decrypt(channel.webhookSecret)?? decrypt(cfg.webhookSecret as string | null)?? undefined;

  return {
    apiKey,
    apiSecret,
    apiUrl: (cfg.apiUrl as string) ?? undefined,
    webhookSecret,
    accountId: (cfg.accountId as string) ?? undefined,
    environment,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Get a fully configured PaymentProvider instance.
 *
 * Priority:
 *   1. channel record from DB (per-tenant credentials, decrypted)
 *   2. environment variables (global fallback)
 */
export function getPaymentProvider(
  providerName: string,
  channel?: ChannelRecord | null
): PaymentProvider {
  const name = providerName.toUpperCase() as ProviderName;

  const config: ProviderConfig = channel
    ? channelToConfig(channel)
    : envConfigFor(name);

  switch (name) {
    case "PALMPESA":
      return new PalmPesaProvider(config);
    case "ZENOPAY":
      return new ZenoPayProvider(config);
    case "MONGIKE":
      return new MongikeProvider(config);
    case "HARAKAPAY":
      return new HarakaPayProvider(config);
    case "STRIPE":
      return new StripeProvider(config);
    case "FLUTTERWAVE":
      return new FlutterwaveProvider(config);
    default:
      throw new Error(`Unknown payment provider: "${providerName}"`);
  }
}

/**
 * Returns all supported provider names.
 */
// E11 FIX: Removed MPESA from supported providers list
export const SUPPORTED_PROVIDERS: ProviderName[] = [
  "PALMPESA",
  "ZENOPAY",
  "MONGIKE",
  "HARAKAPAY",
  "STRIPE",
  "FLUTTERWAVE",
];

export function isSupportedProvider(name: string): name is ProviderName {
  return SUPPORTED_PROVIDERS.includes(name.toUpperCase() as ProviderName);
}
