-- RC-2 FIX: Add serviceType column to routers table.
-- Allows conditional validation: hotspot-only routers do not require pppoePoolRange,
-- and PPPoE-only routers do not require hotspotPoolRange.
-- Defaults to 'both' to preserve backward compatibility with all existing rows.
ALTER TABLE routers
  ADD COLUMN IF NOT EXISTS "serviceType" TEXT DEFAULT 'both';

-- Backfill any NULL values (should not exist due to DEFAULT, but be safe)
UPDATE routers SET "serviceType" = 'both' WHERE "serviceType" IS NULL;
