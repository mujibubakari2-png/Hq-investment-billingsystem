-- Multi-tenant owner refactor
-- Adds tenant-owner metadata, tenant URL slugs, branding/settings tables,
-- tenant-owned gateway metadata, tenant license records, and user creator links.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

UPDATE "tenants"
SET "slug" = lower(
    regexp_replace(
        trim(both '-' from regexp_replace(coalesce("name", 'tenant'), '[^a-zA-Z0-9]+', '-', 'g')),
        '-+',
        '-',
        'g'
    )
) || '-' || substr("id", 1, 6)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "tenants" ALTER COLUMN "slug" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "users_createdById_idx" ON "users"("createdById");
CREATE INDEX IF NOT EXISTS "tenants_ownerUserId_idx" ON "tenants"("ownerUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_createdById_fkey'
    ) THEN
        ALTER TABLE "users"
        ADD CONSTRAINT "users_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_ownerUserId_fkey'
    ) THEN
        ALTER TABLE "tenants"
        ADD CONSTRAINT "tenants_ownerUserId_fkey"
        FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_branding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyLogo" TEXT,
    "companyEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_branding_tenantId_key" ON "tenant_branding"("tenantId");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_branding_tenantId_fkey'
    ) THEN
        ALTER TABLE "tenant_branding"
        ADD CONSTRAINT "tenant_branding_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "enableSubdomain" BOOLEAN NOT NULL DEFAULT true,
    "hotspotAutoSync" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_tenantId_fkey'
    ) THEN
        ALTER TABLE "tenant_settings"
        ADD CONSTRAINT "tenant_settings_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_payment_gateways" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "ChannelStatus" NOT NULL DEFAULT 'INACTIVE',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_payment_gateways_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payment_gateways_tenantId_provider_key"
ON "tenant_payment_gateways"("tenantId", "provider");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_payment_gateways_tenantId_fkey'
    ) THEN
        ALTER TABLE "tenant_payment_gateways"
        ADD CONSTRAINT "tenant_payment_gateways_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_licenses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "TenantInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_licenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tenant_licenses_tenantId_status_idx"
ON "tenant_licenses"("tenantId", "status");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_licenses_tenantId_fkey'
    ) THEN
        ALTER TABLE "tenant_licenses"
        ADD CONSTRAINT "tenant_licenses_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenant_licenses_planId_fkey'
    ) THEN
        ALTER TABLE "tenant_licenses"
        ADD CONSTRAINT "tenant_licenses_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "saas_plans"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Update Prisma _prisma_migrations table so Prisma tracks this as applied
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_prisma_migrations') THEN
        RAISE NOTICE '_prisma_migrations table not found; skip insert';
    ELSE
        INSERT INTO _prisma_migrations (
            id,
            checksum,
            finished_at,
            migration_name,
            logs,
            rolled_back_at,
            started_at,
            applied_steps_count
        ) VALUES (
            gen_random_uuid()::text,
            'manual_multi_tenant_owner_refactor',
            NOW(),
            '20260610_multi_tenant_owner_refactor',
            NULL,
            NULL,
            NOW(),
            1
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;
