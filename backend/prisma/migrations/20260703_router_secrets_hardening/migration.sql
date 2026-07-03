-- SEC-ROUTER-003 FIX
-- Adds a dedicated, per-router RADIUS secret field.
-- Previously: the router's admin `password` was reused as the RADIUS shared
-- secret (radiusNas.secret), and fell back to a static "hqsecret" string when
-- missing.
--
-- Existing rows get NULL. Run `backend/src/scripts/rotateRouterSecrets.ts`
-- after this migration to backfill secure, unique values for all existing
-- routers (this same script also rotates any router still using the
-- literal "admin" username to a unique generated one).

ALTER TABLE "routers" ADD COLUMN "radiusSecret" TEXT;
