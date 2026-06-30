import { paymentChannelsApi } from '../api/financeApi';

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
}

export async function loadProviderChannel(provider: ChannelProvider): Promise<ProviderChannel | null> {
    const rows = await paymentChannelsApi.list();
    const channels = Array.isArray(rows) ? rows : [];
    return (channels.find((ch: any) => String(ch.provider || '').toUpperCase() === provider) as ProviderChannel | undefined) ?? null;
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
