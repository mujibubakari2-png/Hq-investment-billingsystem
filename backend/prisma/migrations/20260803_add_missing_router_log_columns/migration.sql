-- Migration: 20260803_add_missing_router_log_columns
-- Purpose: Add missing audit columns to the `router_logs` table.
--
-- Root cause: The RouterLog model in schema.prisma defines:
--   commandSent, responseReceived, adapterVersion, durationMs
-- These were added via vendor_adapter_schema.sql manually but never
-- tracked as a formal Prisma migration.
--
-- All ALTER TABLE ADD COLUMN statements use IF NOT EXISTS — zero downtime, 
-- safe to run while the application is live, and idempotent if the manual
-- SQL was already applied.
-- ============================================================================

ALTER TABLE "router_logs"
  ADD COLUMN IF NOT EXISTS "commandSent"      TEXT,
  ADD COLUMN IF NOT EXISTS "responseReceived" TEXT,
  ADD COLUMN IF NOT EXISTS "adapterVersion"   TEXT,
  ADD COLUMN IF NOT EXISTS "durationMs"       INTEGER;

-- Also ensure the index exists (from vendor_adapter_schema)
CREATE INDEX IF NOT EXISTS router_logs_action_idx ON "router_logs"("action");
