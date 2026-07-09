-- Migration: add_overdue_to_tenant_invoice_status
-- Adds OVERDUE to the TenantInvoiceStatus enum.
-- The admin saas-invoices route was already setting status = 'OVERDUE' in code
-- but the enum only had PENDING, PAID, EXPIRED — causing a silent type violation.

ALTER TYPE "TenantInvoiceStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';
