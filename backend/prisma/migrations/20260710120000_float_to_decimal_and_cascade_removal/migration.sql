
-- Convert Float fields to Decimal(12, 2)
ALTER TABLE "packages" ALTER COLUMN "price" TYPE DECIMAL(12, 2);
ALTER TABLE "transactions" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "expenses" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "invoices" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "invoice_items" ALTER COLUMN "unitPrice" TYPE DECIMAL(12, 2), ALTER COLUMN "total" TYPE DECIMAL(12, 2);
ALTER TABLE "saas_plans" ALTER COLUMN "price" TYPE DECIMAL(12, 2);
ALTER TABLE "tenant_invoices" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);
ALTER TABLE "tenant_payments" ALTER COLUMN "amount" TYPE DECIMAL(12, 2);

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "equipments" DROP CONSTRAINT IF EXISTS "equipments_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "hotspot_settings" DROP CONSTRAINT IF EXISTS "hotspot_settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "invoice_items_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT IF EXISTS "message_templates_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "packages" DROP CONSTRAINT IF EXISTS "packages_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "payment_channels" DROP CONSTRAINT IF EXISTS "payment_channels_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radacct" DROP CONSTRAINT IF EXISTS "radacct_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radcheck" DROP CONSTRAINT IF EXISTS "radcheck_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radgroupcheck" DROP CONSTRAINT IF EXISTS "radgroupcheck_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radgroupreply" DROP CONSTRAINT IF EXISTS "radgroupreply_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radius_nas" DROP CONSTRAINT IF EXISTS "radius_nas_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radius_users" DROP CONSTRAINT IF EXISTS "radius_users_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radpostauth" DROP CONSTRAINT IF EXISTS "radpostauth_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radusergroup" DROP CONSTRAINT IF EXISTS "radusergroup_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "router_logs" DROP CONSTRAINT IF EXISTS "router_logs_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "routers" DROP CONSTRAINT IF EXISTS "routers_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "sms_messages" DROP CONSTRAINT IF EXISTS "sms_messages_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_packageId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "system_settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_branding" DROP CONSTRAINT IF EXISTS "tenant_branding_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_invoices" DROP CONSTRAINT IF EXISTS "tenant_invoices_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_licenses" DROP CONSTRAINT IF EXISTS "tenant_licenses_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_payment_gateways" DROP CONSTRAINT IF EXISTS "tenant_payment_gateways_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_payments" DROP CONSTRAINT IF EXISTS "tenant_payments_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_settings" DROP CONSTRAINT IF EXISTS "tenant_settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "user_otps" DROP CONSTRAINT IF EXISTS "user_otps_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "vouchers_packageId_fkey";

-- DropForeignKey
ALTER TABLE "vouchers" DROP CONSTRAINT IF EXISTS "vouchers_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "vpn_users" DROP CONSTRAINT IF EXISTS "vpn_users_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_logs" DROP CONSTRAINT IF EXISTS "webhook_logs_tenantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "audit_logs_tenantId_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "idx_audit_logs_tenant_created";

-- DropIndex
DROP INDEX IF EXISTS "clients_deleted_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "clients_username_key";

-- DropIndex
DROP INDEX IF EXISTS "packages_deleted_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "router_logs_tenant_id_created_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "routers_deleted_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "subscriptions_deleted_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "transactions_deleted_at_idx";

-- DropIndex
DROP INDEX IF EXISTS "vouchers_code_key";

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "invoice_items" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "packages" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "radgroupcheck" ALTER COLUMN "groupname" DROP DEFAULT;

-- AlterTable
ALTER TABLE "radgroupreply" ALTER COLUMN "groupname" DROP DEFAULT;

-- AlterTable
ALTER TABLE "radpostauth" ALTER COLUMN "username" DROP DEFAULT,
ALTER COLUMN "pass" DROP DEFAULT,
ALTER COLUMN "reply" DROP DEFAULT;

-- AlterTable
ALTER TABLE "radreply" ALTER COLUMN "username" DROP DEFAULT,
ALTER COLUMN "attribute" SET DEFAULT 'Session-Timeout';

-- AlterTable
ALTER TABLE "radusergroup" ALTER COLUMN "username" DROP DEFAULT,
ALTER COLUMN "groupname" DROP DEFAULT;

-- AlterTable
ALTER TABLE "routers" ALTER COLUMN "wgListenPort" SET DEFAULT 51820;

-- AlterTable
ALTER TABLE "saas_plans" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "lastSyncAttempt";

-- AlterTable
ALTER TABLE "tenant_branding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_invoices" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tenant_licenses" DROP COLUMN "status",
ADD COLUMN     "status" "TenantInvoiceStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_payment_gateways" DROP COLUMN "status",
ADD COLUMN     "status" "ChannelStatus" NOT NULL DEFAULT 'INACTIVE',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_payments" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "tenant_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "mfa_backup_codes",
DROP COLUMN "mfa_enabled",
DROP COLUMN "mfa_secret";

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "clients_tenantId_createdAt_idx" ON "clients"("tenantId", "createdAt");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "clients_username_tenantId_key" ON "clients"("username", "tenantId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "expenses_tenantId_date_idx" ON "expenses"("tenantId", "date");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "invoices_tenantId_dueDate_idx" ON "invoices"("tenantId", "dueDate");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "invoices_tenantId_issuedDate_idx" ON "invoices"("tenantId", "issuedDate");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "payment_channels_tenantId_provider_status_idx" ON "payment_channels"("tenantId", "provider", "status");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_channels_provider_tenantId_key" ON "payment_channels"("provider", "tenantId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "router_logs_tenantId_createdAt_idx" ON "router_logs"("tenantId", "createdAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_activatedAt_idx" ON "subscriptions"("tenantId", "activatedAt");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "tenant_licenses_tenantId_status_idx" ON "tenant_licenses"("tenantId", "status");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "transactions_tenantId_createdAt_idx" ON "transactions"("tenantId", "createdAt");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_code_tenantId_key" ON "vouchers"("code", "tenantId");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "webhook_logs_tenantId_createdAt_idx" ON "webhook_logs"("tenantId", "createdAt");

-- AddForeignKey (idempotent)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenantId_fkey') THEN
  ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_otps_tenantId_fkey') THEN
  ALTER TABLE "user_otps" ADD CONSTRAINT "user_otps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_tenantId_fkey') THEN
  ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'packages_tenantId_fkey') THEN
  ALTER TABLE "packages" ADD CONSTRAINT "packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_packageId_fkey') THEN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenantId_fkey') THEN
  ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_tenantId_fkey') THEN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routers_tenantId_fkey') THEN
  ALTER TABLE "routers" ADD CONSTRAINT "routers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'router_logs_tenantId_fkey') THEN
  ALTER TABLE "router_logs" ADD CONSTRAINT "router_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotspot_settings_tenantId_fkey') THEN
  ALTER TABLE "hotspot_settings" ADD CONSTRAINT "hotspot_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipments_tenantId_fkey') THEN
  ALTER TABLE "equipments" ADD CONSTRAINT "equipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_packageId_fkey') THEN
  ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_tenantId_fkey') THEN
  ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_tenantId_fkey') THEN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenantId_fkey') THEN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_tenantId_fkey') THEN
  ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_messages_tenantId_fkey') THEN
  ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_templates_tenantId_fkey') THEN
  ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_channels_tenantId_fkey') THEN
  ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_logs_tenantId_fkey') THEN
  ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_tenantId_fkey') THEN
  ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_branding_tenantId_fkey') THEN
  ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_tenantId_fkey') THEN
  ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_tenantId_fkey') THEN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_payment_gateways_tenantId_fkey') THEN
  ALTER TABLE "tenant_payment_gateways" ADD CONSTRAINT "tenant_payment_gateways_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_licenses_tenantId_fkey') THEN
  ALTER TABLE "tenant_licenses" ADD CONSTRAINT "tenant_licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invoices_tenantId_fkey') THEN
  ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_payments_tenantId_fkey') THEN
  ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vpn_users_tenantId_fkey') THEN
  ALTER TABLE "vpn_users" ADD CONSTRAINT "vpn_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radius_users_tenantId_fkey') THEN
  ALTER TABLE "radius_users" ADD CONSTRAINT "radius_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radius_nas_tenantId_fkey') THEN
  ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radcheck_tenantId_fkey') THEN
  ALTER TABLE "radcheck" ADD CONSTRAINT "radcheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radreply_tenantId_fkey') THEN
  ALTER TABLE "radreply" ADD CONSTRAINT "radreply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radgroupcheck_tenantId_fkey') THEN
  ALTER TABLE "radgroupcheck" ADD CONSTRAINT "radgroupcheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radgroupreply_tenantId_fkey') THEN
  ALTER TABLE "radgroupreply" ADD CONSTRAINT "radgroupreply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radusergroup_tenantId_fkey') THEN
  ALTER TABLE "radusergroup" ADD CONSTRAINT "radusergroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radacct_tenantId_fkey') THEN
  ALTER TABLE "radacct" ADD CONSTRAINT "radacct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'radpostauth_tenantId_fkey') THEN
  ALTER TABLE "radpostauth" ADD CONSTRAINT "radpostauth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- RenameIndex (safe: only rename if old name exists AND new name does not)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'username_tenantId_attribute')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radcheck_username_tenantId_attribute_key')
  THEN ALTER INDEX "username_tenantId_attribute" RENAME TO "radcheck_username_tenantId_attribute_key"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radgroupcheck_groupname')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radgroupcheck_groupname_idx')
  THEN ALTER INDEX "idx_radgroupcheck_groupname" RENAME TO "radgroupcheck_groupname_idx"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radgroupcheck_groupname_tenant_attribute')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radgroupcheck_groupname_tenantId_attribute_key')
  THEN ALTER INDEX "radgroupcheck_groupname_tenant_attribute" RENAME TO "radgroupcheck_groupname_tenantId_attribute_key"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radgroupreply_groupname')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radgroupreply_groupname_idx')
  THEN ALTER INDEX "idx_radgroupreply_groupname" RENAME TO "radgroupreply_groupname_idx"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radgroupreply_groupname_tenant_attribute_reply')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radgroupreply_groupname_tenantId_attribute_key')
  THEN ALTER INDEX "radgroupreply_groupname_tenant_attribute_reply" RENAME TO "radgroupreply_groupname_tenantId_attribute_key"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radreply_tenant_usr')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radreply_tenantId_username_idx')
  THEN ALTER INDEX "idx_radreply_tenant_usr" RENAME TO "radreply_tenantId_username_idx"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radreply_tenantid')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radreply_tenantId_idx')
  THEN ALTER INDEX "idx_radreply_tenantid" RENAME TO "radreply_tenantId_idx"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radreply_username')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radreply_username_idx')
  THEN ALTER INDEX "idx_radreply_username" RENAME TO "radreply_username_idx"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radreply_username_tenantId_attribute')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radreply_username_tenantId_attribute_key')
  THEN ALTER INDEX "radreply_username_tenantId_attribute" RENAME TO "radreply_username_tenantId_attribute_key"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radusergroup_username')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radusergroup_username_idx')
  THEN ALTER INDEX "idx_radusergroup_username" RENAME TO "radusergroup_username_idx"; END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radusergroup_username_tenant_group')
  AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'radusergroup_username_tenantId_groupname_key')
  THEN ALTER INDEX "radusergroup_username_tenant_group" RENAME TO "radusergroup_username_tenantId_groupname_key"; END IF;
END $$;
