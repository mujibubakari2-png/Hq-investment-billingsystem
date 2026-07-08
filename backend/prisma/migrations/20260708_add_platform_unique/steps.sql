-- Migration: add partial unique index to ensure a single PLATFORM channel per provider
-- Creates a unique index on payment_channels(provider) where tenant_id IS NULL

DO $$
BEGIN
  -- If the table uses snake_case column name 'tenant_id'
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_channels' AND column_name = 'tenant_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i' AND c.relname = 'uniq_payment_channel_provider_platform'
    ) THEN
      CREATE UNIQUE INDEX uniq_payment_channel_provider_platform
      ON public.payment_channels (provider)
      WHERE tenant_id IS NULL;
    END IF;

  -- Otherwise, try camelCase column name 'tenantId'
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_channels' AND column_name = 'tenantId'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'i' AND c.relname = 'uniq_payment_channel_provider_platform'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX uniq_payment_channel_provider_platform ON public.payment_channels (provider) WHERE "tenantId" IS NULL';
    END IF;
  END IF;
END$$;
