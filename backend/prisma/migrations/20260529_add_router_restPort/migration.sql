-- E22 FIX: Add dedicated REST API port field to the routers table.
-- The terminal/Winbox API port (8728) is stored in the existing `port` and `apiPort` columns.
-- RouterOS REST API runs on port 80 (HTTP) or 443 (HTTPS) by default, but some routers
-- expose it on a custom port. This column allows setting that port explicitly per router.
-- When NULL, getMikroTikService() auto-maps port 8728/8729 to 80/443 as before.
ALTER TABLE "routers" ADD COLUMN IF NOT EXISTS "restPort" INTEGER;
