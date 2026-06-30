ALTER TABLE "transactions"
ADD COLUMN IF NOT EXISTS "providerRef" TEXT;

CREATE INDEX IF NOT EXISTS "transactions_providerRef_idx"
ON "transactions"("providerRef");

ALTER TABLE "tenant_invoices"
ADD COLUMN IF NOT EXISTS "providerRef" TEXT;

CREATE INDEX IF NOT EXISTS "tenant_invoices_providerRef_idx"
ON "tenant_invoices"("providerRef");
