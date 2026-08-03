-- Migration: 20260803_add_missing_router_columns
-- Purpose: Add all router columns that exist in schema.prisma but were never
--          added to the production database, causing Prisma findMany() failures.
--
-- Root cause: The Router model was extended in schema.prisma (vendor, model,
-- architecture, firmwareVersion, apiType, capabilities, supportedFeatures,
-- licenseLevel, healthStatus, provisioningStatus, lastDiscovery, lastSync,
-- errorState, featureFlags, radiusSecret, and backup/region fields) but no
-- corresponding ALTER TABLE migration was created for production.
--
-- All columns are nullable / have defaults — zero downtime, safe to run while
-- the application is live.

ALTER TABLE "routers"
  -- Multi-vendor adapter fields
  ADD COLUMN IF NOT EXISTS "vendor"             TEXT DEFAULT 'mikrotik',
  ADD COLUMN IF NOT EXISTS "model"              TEXT,
  ADD COLUMN IF NOT EXISTS "architecture"       TEXT,
  ADD COLUMN IF NOT EXISTS "firmwareVersion"    TEXT,
  ADD COLUMN IF NOT EXISTS "apiType"            TEXT,
  ADD COLUMN IF NOT EXISTS "capabilities"       JSONB,
  ADD COLUMN IF NOT EXISTS "supportedFeatures"  TEXT[],
  ADD COLUMN IF NOT EXISTS "licenseLevel"       TEXT,
  ADD COLUMN IF NOT EXISTS "healthStatus"       TEXT,
  ADD COLUMN IF NOT EXISTS "provisioningStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "lastDiscovery"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastSync"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "errorState"         TEXT,
  ADD COLUMN IF NOT EXISTS "featureFlags"       TEXT,

  -- SEC-ROUTER-003: Per-router RADIUS shared secret (encrypted at rest)
  ADD COLUMN IF NOT EXISTS "radiusSecret"       TEXT,

  -- ENTERPRISE-012: Carrier-Grade Backup Verification
  ADD COLUMN IF NOT EXISTS "lastBackupAt"           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastBackupChecksum"     TEXT,
  ADD COLUMN IF NOT EXISTS "lastBackupUrl"          TEXT,
  ADD COLUMN IF NOT EXISTS "backupSize"             INTEGER,
  ADD COLUMN IF NOT EXISTS "backupType"             TEXT,
  ADD COLUMN IF NOT EXISTS "backupVersion"          TEXT,
  ADD COLUMN IF NOT EXISTS "backupVerified"         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "backupStorage"          TEXT,
  ADD COLUMN IF NOT EXISTS "backupRetentionUntil"   TIMESTAMPTZ,

  -- ENTERPRISE-014: Multi-Region Worker Affinity (Region enum stored as text)
  ADD COLUMN IF NOT EXISTS "region"             TEXT;

-- Backfill: set vendor = 'mikrotik' for all existing rows where type = 'MikroTik'
-- (safe no-op if all rows already have vendor set)
UPDATE "routers"
  SET "vendor" = 'mikrotik'
  WHERE "vendor" IS NULL AND "type" = 'MikroTik';
