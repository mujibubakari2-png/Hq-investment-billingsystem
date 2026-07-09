-- DB-001 FIX: Add missing tenant and operational indexes
-- These indexes prevent full sequential table scans on every tenant-scoped list query.
-- NOTE: CONCURRENTLY removed — Prisma wraps migrations in a transaction block and
-- PostgreSQL does not allow CREATE INDEX CONCURRENTLY inside a transaction.
-- IF NOT EXISTS makes every statement idempotent and safe to re-run.

-- ── routers ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "routers_tenantId_idx"
    ON "routers" ("tenantId");

-- ── router_logs ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "router_logs_routerId_idx"
    ON "router_logs" ("routerId");

CREATE INDEX IF NOT EXISTS "router_logs_tenantId_idx"
    ON "router_logs" ("tenantId");

CREATE INDEX IF NOT EXISTS "router_logs_createdAt_idx"
    ON "router_logs" ("createdAt");

-- ── equipments ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "equipments_tenantId_idx"
    ON "equipments" ("tenantId");

CREATE INDEX IF NOT EXISTS "equipments_status_idx"
    ON "equipments" ("status");

-- ── vouchers ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "vouchers_tenantId_idx"
    ON "vouchers" ("tenantId");

CREATE INDEX IF NOT EXISTS "vouchers_status_idx"
    ON "vouchers" ("status");

-- ── expenses ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "expenses_tenantId_idx"
    ON "expenses" ("tenantId");

CREATE INDEX IF NOT EXISTS "expenses_date_idx"
    ON "expenses" ("date");
