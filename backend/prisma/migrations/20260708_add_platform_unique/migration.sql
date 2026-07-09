-- add_platform_unique
-- Enforces exactly one platform-scoped (tenantId IS NULL) PaymentChannel per
-- provider. Postgres does not treat NULL = NULL as a duplicate under the
-- existing UNIQUE(provider, tenantId) constraint, so multiple PLATFORM-level
-- channels for the same provider could otherwise exist (ambiguous which one
-- is "the" platform gateway for License/Hotspot/PPPoE payments).
--
-- RECOVERY NOTE: this migration previously failed partway on production,
-- almost certainly because duplicate platform rows already existed for at
-- least one provider (which blocks CREATE UNIQUE INDEX). Step 1 below
-- resolves that defensively and non-destructively (deactivates extras,
-- deletes nothing) so Step 2 can succeed. If no duplicates exist, Step 1 is
-- a no-op.

-- Step 1: keep exactly one active platform channel per provider.
-- Deactivate any older duplicates instead of deleting them, and ensure the
-- newest platform channel remains ACTIVE so the partial unique index can be
-- created successfully even when duplicates already existed.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY provider
           ORDER BY "updatedAt" DESC, id DESC
         ) AS rn
  FROM "payment_channels"
  WHERE "tenantId" IS NULL
)
UPDATE "payment_channels" pc
SET status = CASE
  WHEN ranked.rn = 1 THEN 'ACTIVE'
  ELSE 'INACTIVE'
END
FROM ranked
WHERE pc.id = ranked.id;

-- Step 2: enforce the invariant going forward for ACTIVE platform channels only.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_channels_platform_provider_unique"
ON "payment_channels" ("provider")
WHERE "tenantId" IS NULL AND status = 'ACTIVE';
