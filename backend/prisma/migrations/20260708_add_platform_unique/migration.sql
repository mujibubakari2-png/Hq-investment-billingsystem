-- Formal migration: ensure single PLATFORM channel per provider
-- Creates a partial unique index on payment_channels(provider) where tenantId IS NULL
--
-- RECOVERY NOTE: this migration previously failed on production because
-- duplicate platform rows already existed (which blocks CREATE UNIQUE INDEX).
-- Step 1 below resolves that defensively and non-destructively (deactivates
-- extras, deletes nothing) so Step 2 can succeed. If no duplicates exist,
-- Step 1 is a no-op.

-- Step 1: keep exactly one active platform channel per provider.
-- Deactivate older duplicates instead of deleting them, so the newest
-- platform channel remains ACTIVE and the unique index can be created.
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
  WHEN ranked.rn = 1 THEN 'ACTIVE'::"ChannelStatus"
  ELSE 'INACTIVE'::"ChannelStatus"
END
FROM ranked
WHERE pc.id = ranked.id;

-- Step 2: enforce the invariant going forward for ACTIVE platform channels only.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_channel_provider_platform
ON public.payment_channels (provider)
WHERE "tenantId" IS NULL AND status = 'ACTIVE'::"ChannelStatus";
