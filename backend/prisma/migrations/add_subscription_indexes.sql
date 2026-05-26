-- Migration: Add performance indexes to subscriptions table
-- Created: 2026-05-26

-- Index for filtering by tenant (most common query filter)
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");

-- Index for filtering by client
CREATE INDEX IF NOT EXISTS "subscriptions_clientId_idx" ON "subscriptions"("clientId");

-- Index for filtering by status (active/expired/suspended)
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");

-- Index for expiry date queries (daily cron jobs, expiry checks)
CREATE INDEX IF NOT EXISTS "subscriptions_expiresAt_idx" ON "subscriptions"("expiresAt");

-- Composite index for the most common dashboard query pattern
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_status_idx" ON "subscriptions"("tenantId", "status");

-- Composite index for expiry dashboard queries per tenant
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_expiresAt_idx" ON "subscriptions"("tenantId", "expiresAt");

-- Index for filtering by router
CREATE INDEX IF NOT EXISTS "subscriptions_routerId_idx" ON "subscriptions"("routerId");
