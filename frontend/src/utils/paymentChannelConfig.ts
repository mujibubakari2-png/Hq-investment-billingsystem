import { paymentChannelsApi } from '../api/financeApi';
import { normalizeApiList } from '../utils/apiResponse';

export type ChannelProvider = 'PALMPESA' | 'ZENOPAY' | 'HARAKAPAY' | 'MONGIKE' | 'BANK_TRANSFER';

export interface ProviderChannel {
    id: string;
    provider: string;
    name?: string;
    accountNumber?: string | null;
    status?: string;
    environment?: string;
    hasApiKey?: boolean;
    hasApiSecret?: boolean;
    hasWebhookSecret?: boolean;
    // FRONT-PAY-001 FIX: the backend GET /api/payment-channels already returns
    // masked values (e.g. "****a1b2") in these same field names — they were
    // being discarded because this interface didn't declare them, so callers
    // never rendered any indication that a token was already saved.
    apiKey?: string | null;
    apiSecret?: string | null;
    webhookSecret?: string | null;
}

export async function loadProviderChannel(provider: ChannelProvider): Promise<ProviderChannel | null> {
    const rows = normalizeApiList<Record<string, unknown>>(await paymentChannelsApi.list());
    return (rows.find((ch: any) => String(ch.provider || '').toUpperCase() === provider) as ProviderChannel | undefined) ?? null;
}

export async function saveProviderChannel(args: {
    provider: ChannelProvider;
    name: string;
    accountNumber?: string | null;
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
    apiUrl?: string;
    config?: Record<string, unknown>;
    environment?: 'sandbox' | 'live';
}) {
    const existing = await loadProviderChannel(args.provider);
    const payload: Record<string, unknown> = {
        name: args.name,
        provider: args.provider,
        accountNumber: args.accountNumber ?? null,
        environment: args.environment ?? 'live',
        status: 'ACTIVE',
        config: { ...(args.config ?? {}), ...(args.apiUrl ? { apiUrl: args.apiUrl } : {}) },
    };

    if (args.apiKey?.trim()) payload.apiKey = args.apiKey.trim();
    if (args.apiSecret?.trim()) payload.apiSecret = args.apiSecret.trim();
    if (args.webhookSecret?.trim()) payload.webhookSecret = args.webhookSecret.trim();

    return existing
        ? paymentChannelsApi.update(existing.id, payload)
        : paymentChannelsApi.create(payload);
}
