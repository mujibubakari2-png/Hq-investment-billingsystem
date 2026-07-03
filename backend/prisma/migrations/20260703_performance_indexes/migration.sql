-- HIGH-S-002 FIX: Add partial indexes for the highest-traffic query patterns.
--
-- These indexes are deliberately PARTIAL (WHERE deletedAt IS NULL) so they
-- only cover active (non-deleted) records. This keeps the index small, fast,
-- and relevant — soft-deleted records are almost never queried in hot paths.
--
-- All indexes use CREATE INDEX CONCURRENTLY so they can be created without
-- locking the tables in production (no downtime required).
--
-- Run this migration with:
--   psql $DATABASE_URL -f this_file.sql
--
-- Or via Prisma custom migration:
--   npx prisma migrate resolve --applied <migration_name>

-- ── subscriptions ─────────────────────────────────────────────────────────────
-- Used by: subscription listing, expiry checks, billing jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_tenant_status
    ON subscriptions ("tenantId", status)
    WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_tenant_expiry
    ON subscriptions ("tenantId", "expiresAt")
    WHERE "deletedAt" IS NULL AND status = 'ACTIVE';

-- ── clients ───────────────────────────────────────────────────────────────────
-- Used by: client search, RADIUS lookup, PPPoE/hotspot provisioning
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_tenant_username
    ON clients ("tenantId", username)
    WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_tenant_phone
    ON clients ("tenantId", phone)
    WHERE "deletedAt" IS NULL;

-- ── transactions ──────────────────────────────────────────────────────────────
-- Used by: payment history, revenue aggregation, dashboard finance widgets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_tenant_status_created
    ON transactions ("tenantId", status, "createdAt" DESC)
    WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_tenant_reference
    ON transactions ("tenantId", reference)
    WHERE "deletedAt" IS NULL;

-- ── routers ───────────────────────────────────────────────────────────────────
-- Used by: router health checks, MikroTik provisioning
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routers_tenant_status
    ON routers ("tenantId", status)
    WHERE "deletedAt" IS NULL;

-- ── users ─────────────────────────────────────────────────────────────────────
-- Used by: auth login lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_email
    ON users ("tenantId", email)
    WHERE "deletedAt" IS NULL;

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Used by: SUPER_ADMIN audit log viewer (paginated, newest first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_created
    ON audit_logs ("tenantId", "createdAt" DESC);
