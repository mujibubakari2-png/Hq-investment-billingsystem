-- Migration: 20260803_add_missing_active_tables
-- Purpose: Create tables that exist in schema.prisma and are ACTIVELY CALLED
--          by production code, but were never properly migrated.
--
-- Tables created here:
--   1. store_settings     → used by storefront/settings API + super-admin CMS
--   2. contact_messages   → used by super-admin CMS contacts API
--   3. router_provisioning_logs → formalises vendor_adapter_schema.sql into
--                                  Prisma-tracked migration (idempotent)
--
-- All CREATE TABLE statements use IF NOT EXISTS — zero downtime, safe to run
-- while the application is live.
-- ============================================================================

-- ─── 1. store_settings ───────────────────────────────────────────────────────
-- Used by:
--   GET/PUT /api/super-admin/cms/settings → prisma.storeSetting.findMany/upsert
--   GET /api/public/storefront/settings   → prisma.storeSetting.findMany
CREATE TABLE IF NOT EXISTS "store_settings" (
  "key"       TEXT        NOT NULL,
  "value"     JSONB       NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,

  CONSTRAINT "store_settings_pkey" PRIMARY KEY ("key")
);

-- ─── 2. contact_messages ────────────────────────────────────────────────────
-- Used by:
--   GET/PATCH/DELETE /api/super-admin/cms/contacts → prisma.contactMessage.*
CREATE TABLE IF NOT EXISTS "contact_messages" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "name"      TEXT        NOT NULL,
  "email"     TEXT        NOT NULL,
  "message"   TEXT        NOT NULL,
  "status"    TEXT        NOT NULL DEFAULT 'UNREAD',  -- UNREAD | READ | REPLIED
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx    ON "contact_messages"("status");
CREATE INDEX IF NOT EXISTS contact_messages_created_idx   ON "contact_messages"("createdAt" DESC);

-- ─── 3. router_provisioning_logs ─────────────────────────────────────────────
-- Used by:
--   src/lib/provisionExecutor.ts  → db.routerProvisioningLog.create()
--   src/workers/logArchiver.worker.ts → db.routerProvisioningLog.deleteMany()
--
-- NOTE: This table may already exist if vendor_adapter_schema.sql was run
-- manually. CREATE TABLE IF NOT EXISTS makes this fully idempotent.
CREATE TABLE IF NOT EXISTS "router_provisioning_logs" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "routerId"      TEXT        NOT NULL,
  "tenantId"      TEXT,
  "planId"        TEXT        NOT NULL,
  "stepId"        TEXT        NOT NULL,
  "stepName"      TEXT        NOT NULL,
  "vendor"        TEXT        NOT NULL,
  "status"        TEXT        NOT NULL DEFAULT 'PENDING',
  "commandSent"   TEXT,
  "responseData"  TEXT,
  "errorMessage"  TEXT,
  "dryRun"        BOOLEAN     NOT NULL DEFAULT FALSE,
  "attemptNumber" INTEGER     NOT NULL DEFAULT 1,
  "durationMs"    INTEGER,
  "rollbackCmd"   TEXT,
  "startedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"   TIMESTAMPTZ,

  CONSTRAINT "router_provisioning_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "router_provisioning_logs_routerId_fkey"
    FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE CASCADE,
  CONSTRAINT "router_provisioning_logs_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS rpl_router_idx      ON "router_provisioning_logs"("routerId");
CREATE INDEX IF NOT EXISTS rpl_tenant_idx      ON "router_provisioning_logs"("tenantId");
CREATE INDEX IF NOT EXISTS rpl_plan_idx        ON "router_provisioning_logs"("planId");
CREATE INDEX IF NOT EXISTS rpl_status_idx      ON "router_provisioning_logs"("status");
CREATE INDEX IF NOT EXISTS rpl_composite_idx   ON "router_provisioning_logs"("routerId", "planId");
CREATE INDEX IF NOT EXISTS rpl_tenant_date_idx ON "router_provisioning_logs"("tenantId", "startedAt" DESC);
