/**
 * Payment Provider Registry
 *
 * Factory that resolves the correct provider by name, injecting config
 * either from the PaymentChannel DB record or from environment variables.
 */

import { PaymentProvider, ProviderName, ProviderConfig } from "@/lib/payments/types";
import { PalmPesaProvider } from "@/lib/payments/providers/palmpesa";
import { ZenoPayProvider } from "@/lib/payments/providers/zenopay";
import { MongikeProvider } from "@/lib/payments/providers/mongike";
import { HarakaPayProvider } from "@/lib/payments/providers/harakapay";

import { env } from "@/lib/env";
import { decrypt } from "@/lib/encryption";

// ─── Build ProviderConfig from environment variables (fallback) ───────────────

function envConfigFor(provider: ProviderName): ProviderConfig {
  const environment = (env.PAYMENT_ENVIRONMENT ?? "sandbox") as "sandbox" | "live";

  if (process.env.NODE_ENV === "production" && environment === "sandbox") {
    console.error(
      "[PAYMENT] CRITICAL: PAYMENT_ENVIRONMENT=sandbox in a production environment! " +
      "Real payments will be routed to the test gateway — money will NOT be credited. " +
      "Set PAYMENT_ENVIRONMENT=live in your production .env file and restart the server."
    );
  }

  switch (provider) {
    case "PALMPESA":
      // Official base URL: https://palmpesa.drmlelwa.co.tz (no /api suffix).
      // PalmPesaProvider constructs the full path internally per endpoint.
      return {
        apiKey:        env.PALMPESA_API_KEY,
        apiUrl:        env.PALMPESA_API_URL ?? "https://palmpesa.drmlelwa.co.tz",
        webhookSecret: env.PALMPESA_WEBHOOK_SECRET,
        environment,
      } as ProviderConfig;

    case "ZENOPAY":
      // Official base URL: https://zenoapi.com/api/payments
      // Initiate: POST /mobile_money_tanzania
      // Status:   GET  /order-status?order_id={order_id}
      return {
        apiKey:        env.ZENOPAY_API_KEY,
        accountId:     env.ZENOPAY_ACCOUNT_ID,
        apiUrl:        env.ZENOPAY_API_URL ?? "https://zenoapi.com/api/payments",
        webhookSecret: env.ZENOPAY_WEBHOOK_SECRET,
        environment,
      };

    case "MONGIKE":
      // FIX-MG-001: Official base URL is https://mongike.com/api/v1 (NOT api.mongike.com/v1)
      // Verified against official OpenAPI spec at https://mongike.docs.buildwithfern.com/
      // POST /payments/mobile-money/tanzania
      return {
        apiKey:        env.MONGIKE_API_KEY,
        apiSecret:     env.MONGIKE_API_SECRET,
        apiUrl:        env.MONGIKE_API_URL ?? "https://mongike.com/api/v1",
        webhookSecret: env.MONGIKE_WEBHOOK_SECRET,
        environment,
      };

    case "HARAKAPAY":
      // Official base URL: https://harakapay.net
      // Auth: X-API-Key header (single key, no secret)
      // Verified against https://harakapay.net/api/docs
      return {
        apiKey:        env.HARAKAPAY_API_KEY,
        apiUrl:        env.HARAKAPAY_API_URL ?? "https://harakapay.net",
        webhookSecret: env.HARAKAPAY_WEBHOOK_SECRET,
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
 */
function channelToConfig(channel: ChannelRecord): ProviderConfig {
  const cfg = (channel.config ?? {}) as Record<string, unknown>;
  const environment = (channel.environment ?? env.PAYMENT_ENVIRONMENT ?? "sandbox") as
    | "sandbox"
    | "live";

  const apiKey        = decrypt(channel.apiKey)        ?? decrypt(cfg.apiKey        as string | null) ?? undefined;
  const apiSecret     = decrypt(channel.apiSecret)     ?? decrypt(cfg.apiSecret     as string | null) ?? undefined;
  const webhookSecret = decrypt(channel.webhookSecret) ?? decrypt(cfg.webhookSecret as string | null) ?? undefined;

  return {
    apiKey,
    apiSecret,
    apiUrl:       (cfg.apiUrl    as string) ?? undefined,
    webhookSecret,
    accountId:    (cfg.accountId as string) ?? undefined,
    environment,
  } as ProviderConfig;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

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
    default:
      throw new Error(`Unknown payment provider: "${providerName}"`);
  }
}

export const SUPPORTED_PROVIDERS: ProviderName[] = [
  "PALMPESA",
  "ZENOPAY",
  "MONGIKE",
  "HARAKAPAY",
];

export function isSupportedProvider(name: string): name is ProviderName {
  return SUPPORTED_PROVIDERS.includes(name.toUpperCase() as ProviderName);
}
