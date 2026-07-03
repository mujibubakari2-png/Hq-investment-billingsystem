-- Migration: 20260703_router_network_config_fields
-- Purpose: Add missing network configuration fields to the Router model.
--
-- These fields were referenced in src/app/api/routers/[id]/script/route.ts
-- for MikroTik setup script generation, but were never added to the schema.
-- All columns are nullable — existing routers get NULL, and the script endpoint
-- validates them and returns a descriptive 400 if any are missing.

ALTER TABLE "routers"
  ADD COLUMN IF NOT EXISTS "lanIp"            TEXT,
  ADD COLUMN IF NOT EXISTS "lanGateway"       TEXT,
  ADD COLUMN IF NOT EXISTS "hotspotPoolRange" TEXT,
  ADD COLUMN IF NOT EXISTS "pppoePoolRange"   TEXT,
  ADD COLUMN IF NOT EXISTS "dns"              TEXT;
