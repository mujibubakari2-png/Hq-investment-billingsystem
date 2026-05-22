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

// ─── Build ProviderConfig from environment variables (fallback) ───────────────

function envConfigFor(provider: ProviderName): ProviderConfig {
  const environment = (env.PAYMENT_ENVIRONMENT ?? "sandbox") as "sandbox" | "live";

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

function channelToConfig(channel: ChannelRecord): ProviderConfig {
  const cfg = (channel.config ?? {}) as Record<string, unknown>;
  const environment = (channel.environment ?? env.PAYMENT_ENVIRONMENT ?? "sandbox") as
    | "sandbox"
    | "live";

  return {
    apiKey: channel.apiKey ?? (cfg.apiKey as string) ?? undefined,
    apiSecret: channel.apiSecret ?? (cfg.apiSecret as string) ?? undefined,
    apiUrl: (cfg.apiUrl as string) ?? undefined,
    webhookSecret:
      channel.webhookSecret ?? (cfg.webhookSecret as string) ?? undefined,
    accountId: (cfg.accountId as string) ?? undefined,
    environment,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Get a fully configured PaymentProvider instance.
 *
 * Priority:
 *   1. channel record from DB (per-tenant credentials)
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
    default:
      throw new Error(`Unknown payment provider: "${providerName}"`);
  }
}

/**
 * Returns all supported provider names.
 */
export const SUPPORTED_PROVIDERS: ProviderName[] = [
  "PALMPESA",
  "ZENOPAY",
  "MONGIKE",
  "HARAKAPAY",
];

export function isSupportedProvider(name: string): name is ProviderName {
  return SUPPORTED_PROVIDERS.includes(name.toUpperCase() as ProviderName);
}
