-- ============================================================
-- Migration: vendor_adapter_schema
-- Applies changes for multi-vendor adapter architecture
-- Run manually: psql -d hqinvestment_isp -f this_file.sql
-- ============================================================

-- 1. Upgrade router_logs with per-command audit trail
ALTER TABLE router_logs
  ADD COLUMN IF NOT EXISTS "commandSent"      TEXT,
  ADD COLUMN IF NOT EXISTS "responseReceived" TEXT,
  ADD COLUMN IF NOT EXISTS "adapterVersion"   TEXT,
  ADD COLUMN IF NOT EXISTS "durationMs"       INTEGER;

CREATE INDEX IF NOT EXISTS router_logs_action_idx ON router_logs(action);

-- 2. capabilities: TEXT -> JSONB (safe cast with NULL guard)
ALTER TABLE routers
  ALTER COLUMN capabilities TYPE JSONB USING
    CASE WHEN capabilities IS NULL OR trim(capabilities)='' THEN NULL
    ELSE capabilities::JSONB END;

-- 3. supportedFeatures: TEXT -> TEXT[] (split on comma)
ALTER TABLE routers
  ALTER COLUMN "supportedFeatures" TYPE TEXT[] USING
    CASE WHEN "supportedFeatures" IS NULL OR trim("supportedFeatures")='' THEN ARRAY[]::TEXT[]
    ELSE string_to_array("supportedFeatures", ',') END;

-- 4. Create router_provisioning_logs
CREATE TABLE IF NOT EXISTS router_provisioning_logs (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "routerId"      TEXT        NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
  "tenantId"      TEXT        REFERENCES tenants(id) ON DELETE SET NULL,
  "planId"        TEXT        NOT NULL,
  "stepId"        TEXT        NOT NULL,
  "stepName"      TEXT        NOT NULL,
  vendor          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING',
  "commandSent"   TEXT,
  "responseData"  TEXT,
  "errorMessage"  TEXT,
  "dryRun"        BOOLEAN     NOT NULL DEFAULT FALSE,
  "attemptNumber" INTEGER     NOT NULL DEFAULT 1,
  "durationMs"    INTEGER,
  "rollbackCmd"   TEXT,
  "startedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS rpl_router_idx    ON router_provisioning_logs("routerId");
CREATE INDEX IF NOT EXISTS rpl_tenant_idx    ON router_provisioning_logs("tenantId");
CREATE INDEX IF NOT EXISTS rpl_plan_idx      ON router_provisioning_logs("planId");
CREATE INDEX IF NOT EXISTS rpl_status_idx    ON router_provisioning_logs(status);
CREATE INDEX IF NOT EXISTS rpl_composite_idx ON router_provisioning_logs("routerId","planId");
