-- Formal migration: ensure single PLATFORM channel per provider
-- Creates a partial unique index on payment_channels(provider) where tenant_id IS NULL

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_channel_provider_platform
ON public.payment_channels (provider)
WHERE tenant_id IS NULL;
