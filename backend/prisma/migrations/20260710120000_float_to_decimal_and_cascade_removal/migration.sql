
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
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "clients" DROP CONSTRAINT "clients_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "equipments" DROP CONSTRAINT "equipments_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "hotspot_settings" DROP CONSTRAINT "hotspot_settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "packages" DROP CONSTRAINT "packages_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "payment_channels" DROP CONSTRAINT "payment_channels_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radacct" DROP CONSTRAINT "radacct_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radcheck" DROP CONSTRAINT "radcheck_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radgroupcheck" DROP CONSTRAINT "radgroupcheck_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radgroupreply" DROP CONSTRAINT "radgroupreply_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radius_nas" DROP CONSTRAINT "radius_nas_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radius_users" DROP CONSTRAINT "radius_users_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radpostauth" DROP CONSTRAINT "radpostauth_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "radusergroup" DROP CONSTRAINT "radusergroup_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "router_logs" DROP CONSTRAINT "router_logs_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "routers" DROP CONSTRAINT "routers_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "sms_messages" DROP CONSTRAINT "sms_messages_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_packageId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_branding" DROP CONSTRAINT "tenant_branding_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_invoices" DROP CONSTRAINT "tenant_invoices_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_licenses" DROP CONSTRAINT "tenant_licenses_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_payment_gateways" DROP CONSTRAINT "tenant_payment_gateways_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_payments" DROP CONSTRAINT "tenant_payments_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_settings" DROP CONSTRAINT "tenant_settings_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "user_otps" DROP CONSTRAINT "user_otps_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "vouchers" DROP CONSTRAINT "vouchers_packageId_fkey";

-- DropForeignKey
ALTER TABLE "vouchers" DROP CONSTRAINT "vouchers_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "vpn_users" DROP CONSTRAINT "vpn_users_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_logs" DROP CONSTRAINT "webhook_logs_tenantId_fkey";

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
ALTER TABLE "subscriptions" DROP COLUMN "lastSyncAttempt";

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

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "clients_tenantId_createdAt_idx" ON "clients"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "clients_username_tenantId_key" ON "clients"("username", "tenantId");

-- CreateIndex
CREATE INDEX "expenses_tenantId_date_idx" ON "expenses"("tenantId", "date");

-- CreateIndex
CREATE INDEX "invoices_tenantId_dueDate_idx" ON "invoices"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_tenantId_issuedDate_idx" ON "invoices"("tenantId", "issuedDate");

-- CreateIndex
CREATE INDEX "payment_channels_tenantId_provider_status_idx" ON "payment_channels"("tenantId", "provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_channels_provider_tenantId_key" ON "payment_channels"("provider", "tenantId");

-- CreateIndex
CREATE INDEX "router_logs_tenantId_createdAt_idx" ON "router_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_activatedAt_idx" ON "subscriptions"("tenantId", "activatedAt");

-- CreateIndex
CREATE INDEX "tenant_licenses_tenantId_status_idx" ON "tenant_licenses"("tenantId", "status");

-- CreateIndex
CREATE INDEX "transactions_tenantId_createdAt_idx" ON "transactions"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_tenantId_key" ON "vouchers"("code", "tenantId");

-- CreateIndex
CREATE INDEX "webhook_logs_tenantId_createdAt_idx" ON "webhook_logs"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_otps" ADD CONSTRAINT "user_otps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routers" ADD CONSTRAINT "routers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "router_logs" ADD CONSTRAINT "router_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotspot_settings" ADD CONSTRAINT "hotspot_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payment_gateways" ADD CONSTRAINT "tenant_payment_gateways_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_licenses" ADD CONSTRAINT "tenant_licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_users" ADD CONSTRAINT "vpn_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radius_users" ADD CONSTRAINT "radius_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radcheck" ADD CONSTRAINT "radcheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radreply" ADD CONSTRAINT "radreply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radgroupcheck" ADD CONSTRAINT "radgroupcheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radgroupreply" ADD CONSTRAINT "radgroupreply_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radusergroup" ADD CONSTRAINT "radusergroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radacct" ADD CONSTRAINT "radacct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radpostauth" ADD CONSTRAINT "radpostauth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "username_tenantId_attribute" RENAME TO "radcheck_username_tenantId_attribute_key";

-- RenameIndex
ALTER INDEX "idx_radgroupcheck_groupname" RENAME TO "radgroupcheck_groupname_idx";

-- RenameIndex
ALTER INDEX "radgroupcheck_groupname_tenant_attribute" RENAME TO "radgroupcheck_groupname_tenantId_attribute_key";

-- RenameIndex
ALTER INDEX "idx_radgroupreply_groupname" RENAME TO "radgroupreply_groupname_idx";

-- RenameIndex
ALTER INDEX "radgroupreply_groupname_tenant_attribute_reply" RENAME TO "radgroupreply_groupname_tenantId_attribute_key";

-- RenameIndex
ALTER INDEX "idx_radreply_tenant_usr" RENAME TO "radreply_tenantId_username_idx";

-- RenameIndex
ALTER INDEX "idx_radreply_tenantid" RENAME TO "radreply_tenantId_idx";

-- RenameIndex
ALTER INDEX "idx_radreply_username" RENAME TO "radreply_username_idx";

-- RenameIndex
ALTER INDEX "radreply_username_tenantId_attribute" RENAME TO "radreply_username_tenantId_attribute_key";

-- RenameIndex
ALTER INDEX "idx_radusergroup_username" RENAME TO "radusergroup_username_idx";

-- RenameIndex
ALTER INDEX "radusergroup_username_tenant_group" RENAME TO "radusergroup_username_tenantId_groupname_key";

