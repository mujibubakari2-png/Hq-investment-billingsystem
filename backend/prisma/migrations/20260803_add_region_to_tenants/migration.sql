-- Migration: 20260803_add_region_to_tenants
-- Purpose: Add the `region` column to the `tenants` table.
--
-- Root cause: The Tenant model in schema.prisma defines:
--   region  Region  @default(GLOBAL)
-- but no migration was ever created to add this column to the production
-- `tenants` table, causing:
--   Invalid `prisma.tenant.findUnique()` invocation:
--   The column `tenants.region` does not exist in the current database.
--
-- ENTERPRISE-014: Multi-Region Worker Affinity
--
-- Note: The `Region` enum type may not exist in the database yet (routers.region
-- was added as TEXT in a prior migration). We create it here idempotently and
-- then add the column to tenants. Safe to run while the application is live.

-- Step 1: Create the Region PostgreSQL ENUM type (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Region') THEN
    CREATE TYPE "Region" AS ENUM ('AFRICA', 'EUROPE', 'ASIA', 'AMERICAS', 'GLOBAL');
  END IF;
END
$$;

-- Step 2: Add region column to tenants (idempotent, safe on live DB)
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "region" "Region" NOT NULL DEFAULT 'GLOBAL';
