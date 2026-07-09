-- =============================================================================
-- Migration: 20260612_phase1_soft_delete_mfa_indexes
-- Phase 1 Audit Remediation — HQ Investment ISP Platform
-- 
-- Changes:
--   CRIT-005: Add soft-delete (deleted_at) to client-facing models
--   CRIT-002: Add MFA fields to users table
--   DB-003:   Add missing indexes to router_logs
--   Phase 1:  Add lastSyncAttempt to subscriptions
-- 
-- Apply on server:
--   psql $DATABASE_URL -f backend/prisma/migrations/20260612_phase1_soft_delete_mfa_indexes/migration.sql
-- Or via Prisma:
--   pnpm --filter backend exec prisma migrate resolve --applied 20260612_phase1_soft_delete_mfa_indexes
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-005: Soft Delete — users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx
  ON users ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-002: MFA fields — users
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled      BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret       TEXT,
  ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[]   NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-005: Soft Delete — clients
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_deleted_at_idx
  ON clients ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-005: Soft Delete — packages
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS packages_deleted_at_idx
  ON packages ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-005 + Sync status: Soft Delete + lastSyncAttempt — subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS "deletedAt"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastSyncAttempt"   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS subscriptions_deleted_at_idx
  ON subscriptions ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-005: Soft Delete — transactions
-- (Billing records: kept for compliance — never truly purged, just hidden)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS transactions_deleted_at_idx
  ON transactions ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- CRIT-005: Soft Delete — routers
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE routers
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS routers_tenantId_idx
  ON routers ("tenantId");

CREATE INDEX IF NOT EXISTS routers_deleted_at_idx
  ON routers ("deletedAt");

-- ─────────────────────────────────────────────────────────────────────────────
-- DB-003: Missing indexes on router_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS router_logs_router_id_idx
  ON router_logs ("routerId");

CREATE INDEX IF NOT EXISTS router_logs_tenant_id_created_at_idx
  ON router_logs ("tenantId", "createdAt" DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Update Prisma _prisma_migrations table so Prisma tracks this as applied
-- ─────────────────────────────────────────────────────────────────────────────
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
  'manual_phase1_audit_remediation',
  NOW(),
  '20260612_phase1_soft_delete_mfa_indexes',
  NULL,
  NULL,
  NOW(),
  1
) ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- Post-migration verification queries (run after COMMIT to confirm changes)
-- =============================================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('deleted_at', 'mfa_enabled', 'mfa_secret', 'mfa_backup_codes');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'deleted_at';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'router_logs' AND indexname LIKE 'router_logs_%';
