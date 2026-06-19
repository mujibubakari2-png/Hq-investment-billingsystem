-- DB-001 FIX: Add missing tenant and operational indexes
-- These indexes prevent full sequential table scans on every tenant-scoped list query.
-- Uses CREATE INDEX CONCURRENTLY to avoid locking tables in production.
-- Run this migration during a low-traffic window.

-- ── routers ──────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "routers_tenantId_idx"
    ON "routers" ("tenantId");

-- ── router_logs ───────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "router_logs_routerId_idx"
    ON "router_logs" ("routerId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "router_logs_tenantId_idx"
    ON "router_logs" ("tenantId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "router_logs_createdAt_idx"
    ON "router_logs" ("createdAt");

-- ── equipments ────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "equipments_tenantId_idx"
    ON "equipments" ("tenantId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "equipments_status_idx"
    ON "equipments" ("status");

-- ── vouchers ──────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "vouchers_tenantId_idx"
    ON "vouchers" ("tenantId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "vouchers_status_idx"
    ON "vouchers" ("status");

-- ── expenses ──────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "expenses_tenantId_idx"
    ON "expenses" ("tenantId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "expenses_date_idx"
    ON "expenses" ("date");
