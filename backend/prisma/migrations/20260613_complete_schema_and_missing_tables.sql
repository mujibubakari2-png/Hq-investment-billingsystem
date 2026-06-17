-- ============================================================================
-- MIGRATION: 20260613_complete_schema_and_missing_tables
-- Phase 2 Audit Completion — HQ Investment ISP Platform
--
-- Purpose: Complete the database schema by adding missing tables identified
-- during the comprehensive audit, including:
--   • tenant_branding, tenant_settings, tenant_payment_gateways, tenant_licenses
--   • audit_logs (critical for compliance and debugging)
--   • Invoice items tenantId FK relationship
--   • Missing tenantId on RADIUS group tables
--   • User createdBy relationship for audit trail
--
-- Apply on existing database:
--   psql $DATABASE_URL -f this-file.sql
--
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Add missing columns to existing tables
-- ────────────────────────────────────────────────────────────────────────────

-- Users: createdBy relationship and isPlatformAdmin flag
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "users_createdById_idx" ON "users"("createdById");

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

-- Tenants: owner reference, slug, logo, URLs
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

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

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_ownerUserId_idx" ON "tenants"("ownerUserId");

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

-- Invoice Items: add tenantId for proper scoping
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
CREATE INDEX IF NOT EXISTS "invoice_items_tenantId_idx" ON "invoice_items"("tenantId");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_tenantId_fkey'
    ) THEN
        ALTER TABLE "invoice_items"
        ADD CONSTRAINT "invoice_items_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- RADIUS group tables: add tenantId
ALTER TABLE "radgroupcheck" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "radgroupreply" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "radusergroup" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

CREATE INDEX IF NOT EXISTS "radgroupcheck_tenantId_idx" ON "radgroupcheck"("tenantId");
CREATE INDEX IF NOT EXISTS "radgroupcheck_tenantId_groupname_idx" ON "radgroupcheck"("tenantId", "groupname");
CREATE UNIQUE INDEX IF NOT EXISTS "radgroupcheck_groupname_tenant_attribute" ON "radgroupcheck"("groupname", "tenantId", "attribute");

CREATE INDEX IF NOT EXISTS "radgroupreply_tenantId_idx" ON "radgroupreply"("tenantId");
CREATE INDEX IF NOT EXISTS "radgroupreply_tenantId_groupname_idx" ON "radgroupreply"("tenantId", "groupname");
CREATE UNIQUE INDEX IF NOT EXISTS "radgroupreply_groupname_tenant_attribute_reply" ON "radgroupreply"("groupname", "tenantId", "attribute");

CREATE INDEX IF NOT EXISTS "radusergroup_tenantId_idx" ON "radusergroup"("tenantId");
CREATE INDEX IF NOT EXISTS "radusergroup_tenantId_username_idx" ON "radusergroup"("tenantId", "username");
CREATE UNIQUE INDEX IF NOT EXISTS "radusergroup_username_tenant_group" ON "radusergroup"("username", "tenantId", "groupname");

-- FK relationships for RADIUS group tables
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'radgroupcheck_tenantId_fkey'
    ) THEN
        ALTER TABLE "radgroupcheck"
        ADD CONSTRAINT "radgroupcheck_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'radgroupreply_tenantId_fkey'
    ) THEN
        ALTER TABLE "radgroupreply"
        ADD CONSTRAINT "radgroupreply_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'radusergroup_tenantId_fkey'
    ) THEN
        ALTER TABLE "radusergroup"
        ADD CONSTRAINT "radusergroup_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Create missing tables
-- ────────────────────────────────────────────────────────────────────────────

-- tenant_branding
CREATE TABLE IF NOT EXISTS "tenant_branding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL UNIQUE,
    "companyName" TEXT NOT NULL,
    "companyLogo" TEXT,
    "companyEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

-- tenant_settings
CREATE TABLE IF NOT EXISTS "tenant_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL UNIQUE,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
    "enableSubdomain" BOOLEAN NOT NULL DEFAULT true,
    "hotspotAutoSync" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

-- tenant_payment_gateways
CREATE TABLE IF NOT EXISTS "tenant_payment_gateways" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_payment_gateways_tenantId_provider_key" UNIQUE("tenantId", "provider")
);

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

-- tenant_licenses
CREATE TABLE IF NOT EXISTS "tenant_licenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "tenant_licenses_tenantId_status_idx" ON "tenant_licenses"("tenantId", "status");

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

-- audit_logs (CRITICAL for compliance and debugging)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_tenantId_fkey'
    ) THEN
        ALTER TABLE "audit_logs"
        ADD CONSTRAINT "audit_logs_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_userId_fkey'
    ) THEN
        ALTER TABLE "audit_logs"
        ADD CONSTRAINT "audit_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Verification
-- ────────────────────────────────────────────────────────────────────────────

-- Verify table creation
SELECT 'Table Creation Verification:' as check;
SELECT count(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Verify tenantId presence on critical tables
SELECT 'TenantId Column Verification:' as check;
SELECT table_name, count(*) as has_tenantId_column
FROM information_schema.columns 
WHERE table_schema = 'public' AND column_name = 'tenantId'
GROUP BY table_name ORDER BY table_name;

-- Verify foreign key constraints
SELECT 'Foreign Key Constraints:' as check;
SELECT count(*) as fk_count 
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

COMMIT;

-- ============================================================================
-- End of migration. All missing tables and columns are now created.
-- ============================================================================
