-- Prisma migration: invoice payment flow + performance indexes
-- Generated: 2026-06-04

-- ── transactions: add invoiceId column ───────────────────────────────────────
ALTER TABLE "transactions" ADD COLUMN "invoiceId" TEXT;

-- FK: transactions.invoiceId → invoices.id
-- SET NULL on delete: deleting an invoice does NOT cascade-delete payment history
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- DB-001: indexes on transactions (covers common query patterns)
CREATE INDEX IF NOT EXISTS "transactions_tenantId_status_idx"  ON "transactions"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "transactions_clientId_idx"         ON "transactions"("clientId");
CREATE INDEX IF NOT EXISTS "transactions_createdAt_idx"        ON "transactions"("createdAt");
CREATE INDEX IF NOT EXISTS "transactions_status_createdAt_idx" ON "transactions"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "transactions_invoiceId_idx"        ON "transactions"("invoiceId");

-- ── invoices: add paidAt + transactionId columns ──────────────────────────────
ALTER TABLE "invoices" ADD COLUMN "paidAt"        TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "transactionId" TEXT;

-- One invoice can only be settled by one transaction
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_transactionId_key" UNIQUE ("transactionId");

-- DB-002: indexes on invoices
CREATE INDEX IF NOT EXISTS "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "invoices_dueDate_idx"         ON "invoices"("dueDate");
CREATE INDEX IF NOT EXISTS "invoices_clientId_idx"        ON "invoices"("clientId");
