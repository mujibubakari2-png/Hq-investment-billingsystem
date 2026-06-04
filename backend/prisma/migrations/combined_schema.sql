-- ============================================================================
-- HQ INVESTMENT — COMBINED SCHEMA MIGRATION
-- ============================================================================
-- Inachanganya migration files zote katika file moja.
-- Tumia hii kwenye server mpya:
--
--   PGPASSWORD=<password> psql -h <host> -p <port> -U <user> -d <dbname> \
--       -f combined_schema.sql
--
-- Kila statement imetumia IF NOT EXISTS / DO $$ blocks ili iwe SALAMA
-- ku-run hata kama schema tayari ipo (idempotent).
-- Tables zote zitatoka TUPU — hakuna data iliyowekwa.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1: ENUMs
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ServiceType" AS ENUM ('HOTSPOT', 'PPPOE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED', 'BANNED', 'DISABLED', 'LIMITED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'BUSINESS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "DurationUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS', 'MONTHS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PackageStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "HotspotType" AS ENUM ('UNLIMITED', 'DATA_CAPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentType" AS ENUM ('PREPAID', 'POSTPAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'EXTENDED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OnlineStatus" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TransactionType" AS ENUM ('MANUAL', 'MOBILE', 'VOUCHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "RouterStatus" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "VoucherStatus" AS ENUM ('UNUSED', 'ACTIVE', 'USED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'UNPAID', 'OVERDUE', 'DRAFT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'FAILED', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SmsType" AS ENUM ('BROADCAST', 'INDIVIDUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TemplateType" AS ENUM ('ACTIVATION', 'EXPIRY', 'PAYMENT', 'CUSTOM', 'REMINDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TenantStatus" AS ENUM ('PENDING_APPROVAL', 'TRIALLING', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TenantInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2: CORE TABLES (bila data — tupu)
-- ────────────────────────────────────────────────────────────────────────────

-- saas_plans (lazima iwe kwanza kwa sababu tenants inategemea)
CREATE TABLE IF NOT EXISTS "saas_plans" (
    "id"          TEXT             NOT NULL,
    "name"        TEXT             NOT NULL,
    "price"       DOUBLE PRECISION NOT NULL,
    "clientLimit" INTEGER          NOT NULL,
    "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

-- tenants
CREATE TABLE IF NOT EXISTS "tenants" (
    "id"               TEXT           NOT NULL,
    "name"             TEXT           NOT NULL,
    "email"            TEXT           NOT NULL,
    "phone"            TEXT,
    "status"           "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "planId"           TEXT           NOT NULL,
    "trialStart"       TIMESTAMP(3),
    "trialEnd"         TIMESTAMP(3),
    "licenseExpiresAt" TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- users
CREATE TABLE IF NOT EXISTS "users" (
    "id"        TEXT         NOT NULL,
    "username"  TEXT         NOT NULL,
    "fullName"  TEXT,
    "email"     TEXT         NOT NULL,
    "password"  TEXT         NOT NULL,
    "phone"     TEXT,
    "role"      "Role"       NOT NULL DEFAULT 'AGENT',
    "status"    "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId"  TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- user_otps
CREATE TABLE IF NOT EXISTS "user_otps" (
    "id"        TEXT         NOT NULL,
    "email"     TEXT,
    "otp"       TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used"      BOOLEAN      NOT NULL DEFAULT false,
    "tenantId"  TEXT,

    CONSTRAINT "user_otps_pkey" PRIMARY KEY ("id")
);

-- routers (lazima iwe kabla ya packages, subscriptions, vpn_users, router_logs, hotspot_settings, equipments, vouchers)
CREATE TABLE IF NOT EXISTS "routers" (
    "id"               TEXT           NOT NULL,
    "name"             TEXT           NOT NULL,
    "host"             TEXT           NOT NULL,
    "username"         TEXT           DEFAULT 'admin',
    "password"         TEXT,
    "port"             INTEGER        DEFAULT 8728,
    "type"             TEXT           NOT NULL DEFAULT 'MikroTik',
    "status"           "RouterStatus" NOT NULL DEFAULT 'OFFLINE',
    "activeUsers"      INTEGER        NOT NULL DEFAULT 0,
    "cpuLoad"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsed"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uptime"           TEXT,
    "lastSeen"         TIMESTAMP(3),
    "accountingEnabled" BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)   NOT NULL,
    "tenantId"         TEXT,
    "apiPort"          INTEGER        DEFAULT 8728,
    "restPort"         INTEGER,
    "description"      TEXT,
    "vpnMode"          TEXT           DEFAULT 'hybrid',
    "wgConfiguredAt"   TIMESTAMP(3),
    "wgEnabled"        BOOLEAN        NOT NULL DEFAULT false,
    "wgListenPort"     INTEGER        DEFAULT 13231,
    "wgPeerPublicKey"  TEXT,
    "wgPresharedKey"   TEXT,
    "wgPrivateKey"     TEXT,
    "wgPublicKey"      TEXT,
    "wgServerEndpoint" TEXT,
    "wgTunnelIp"       TEXT           DEFAULT '10.200.0.1',

    CONSTRAINT "routers_pkey" PRIMARY KEY ("id")
);

-- clients
CREATE TABLE IF NOT EXISTS "clients" (
    "id"          TEXT            NOT NULL,
    "username"    TEXT            NOT NULL,
    "fullName"    TEXT            NOT NULL,
    "phone"       TEXT,
    "email"       TEXT,
    "serviceType" "ServiceType"   NOT NULL,
    "status"      "ClientStatus"  NOT NULL DEFAULT 'ACTIVE',
    "accountType" "AccountType"   NOT NULL DEFAULT 'PERSONAL',
    "macAddress"  TEXT,
    "device"      TEXT,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)    NOT NULL,
    "tenantId"    TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- packages
CREATE TABLE IF NOT EXISTS "packages" (
    "id"            TEXT              NOT NULL,
    "name"          TEXT              NOT NULL,
    "type"          "ServiceType"     NOT NULL,
    "category"      "AccountType"     NOT NULL DEFAULT 'PERSONAL',
    "uploadSpeed"   DOUBLE PRECISION  NOT NULL,
    "uploadUnit"    TEXT              NOT NULL DEFAULT 'Mbps',
    "downloadSpeed" DOUBLE PRECISION  NOT NULL,
    "downloadUnit"  TEXT              NOT NULL DEFAULT 'Mbps',
    "price"         DOUBLE PRECISION  NOT NULL,
    "duration"      INTEGER           NOT NULL,
    "durationUnit"  "DurationUnit"    NOT NULL,
    "status"        "PackageStatus"   NOT NULL DEFAULT 'ACTIVE',
    "burstEnabled"  BOOLEAN           NOT NULL DEFAULT false,
    "hotspotType"   "HotspotType",
    "devices"       INTEGER           DEFAULT 1,
    "paymentType"   "PaymentType"     NOT NULL DEFAULT 'PREPAID',
    "createdAt"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)      NOT NULL,
    "routerId"      TEXT,
    "tenantId"      TEXT,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id"           TEXT                  NOT NULL,
    "clientId"     TEXT                  NOT NULL,
    "packageId"    TEXT                  NOT NULL,
    "routerId"     TEXT,
    "status"       "SubscriptionStatus"  NOT NULL DEFAULT 'ACTIVE',
    "method"       TEXT,
    "activatedAt"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"    TIMESTAMP(3)          NOT NULL,
    "dataUsed"     TEXT,
    "onlineStatus" "OnlineStatus"        DEFAULT 'OFFLINE',
    "syncStatus"   TEXT,
    "createdAt"    TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)          NOT NULL,
    "tenantId"     TEXT,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- invoices (lazima iwe kabla ya transactions kwa FK transactions.invoiceId)
CREATE TABLE IF NOT EXISTS "invoices" (
    "id"            TEXT            NOT NULL,
    "invoiceNumber" TEXT            NOT NULL,
    "clientId"      TEXT            NOT NULL,
    "amount"        DOUBLE PRECISION NOT NULL,
    "status"        "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate"       TIMESTAMP(3)    NOT NULL,
    "issuedDate"    TIMESTAMP(3)    NOT NULL,
    "paidAt"        TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)    NOT NULL,
    "tenantId"      TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- transactions
CREATE TABLE IF NOT EXISTS "transactions" (
    "id"        TEXT                  NOT NULL,
    "clientId"  TEXT                  NOT NULL,
    "planName"  TEXT,
    "amount"    DOUBLE PRECISION      NOT NULL,
    "type"      "TransactionType"     NOT NULL DEFAULT 'MOBILE',
    "method"    TEXT                  NOT NULL,
    "status"    "TransactionStatus"   NOT NULL DEFAULT 'PENDING',
    "reference" TEXT                  NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "packageId" TEXT,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)          NOT NULL,
    "tenantId"  TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- router_logs
CREATE TABLE IF NOT EXISTS "router_logs" (
    "id"        TEXT         NOT NULL,
    "routerId"  TEXT         NOT NULL,
    "action"    TEXT         NOT NULL,
    "details"   TEXT,
    "status"    TEXT         NOT NULL DEFAULT 'success',
    "username"  TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId"  TEXT,

    CONSTRAINT "router_logs_pkey" PRIMARY KEY ("id")
);

-- hotspot_settings
CREATE TABLE IF NOT EXISTS "hotspot_settings" (
    "id"                  TEXT         NOT NULL,
    "routerId"            TEXT         NOT NULL,
    "primaryColor"        TEXT         NOT NULL DEFAULT '#1a1a2e',
    "accentColor"         TEXT         NOT NULL DEFAULT '#6366f1',
    "selectedFont"        TEXT         NOT NULL DEFAULT 'Inter',
    "layout"              TEXT         NOT NULL DEFAULT 'grid',
    "enableAds"           BOOLEAN      NOT NULL DEFAULT false,
    "enableAnnouncement"  BOOLEAN      NOT NULL DEFAULT true,
    "enableRememberMe"    BOOLEAN      NOT NULL DEFAULT true,
    "companyName"         TEXT,
    "customerCareNumber"  TEXT,
    "backendUrl"          TEXT,
    "adMessage"           TEXT         DEFAULT '🎉 Special offer! Get extra data on all packages today!',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    "tenantId"            TEXT,

    CONSTRAINT "hotspot_settings_pkey" PRIMARY KEY ("id")
);

-- equipments
CREATE TABLE IF NOT EXISTS "equipments" (
    "id"           TEXT              NOT NULL,
    "name"         TEXT              NOT NULL,
    "type"         TEXT              NOT NULL,
    "serialNumber" TEXT              NOT NULL,
    "status"       "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "location"     TEXT,
    "assignedTo"   TEXT,
    "purchaseDate" TIMESTAMP(3),
    "notes"        TEXT,
    "routerId"     TEXT,
    "createdAt"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)      NOT NULL,
    "tenantId"     TEXT,

    CONSTRAINT "equipments_pkey" PRIMARY KEY ("id")
);

-- vouchers
CREATE TABLE IF NOT EXISTS "vouchers" (
    "id"          TEXT            NOT NULL,
    "code"        TEXT            NOT NULL,
    "packageId"   TEXT            NOT NULL,
    "routerId"    TEXT,
    "status"      "VoucherStatus" NOT NULL DEFAULT 'UNUSED',
    "createdById" TEXT            NOT NULL,
    "usedBy"      TEXT,
    "usedAt"      TIMESTAMP(3),
    "customer"    INTEGER,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)    NOT NULL,
    "tenantId"    TEXT,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- expenses
CREATE TABLE IF NOT EXISTS "expenses" (
    "id"          TEXT             NOT NULL,
    "category"    TEXT             NOT NULL,
    "description" TEXT             NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "date"        TIMESTAMP(3)     NOT NULL,
    "reference"   TEXT,
    "receipt"     TEXT,
    "createdById" TEXT             NOT NULL,
    "createdAt"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)     NOT NULL,
    "tenantId"    TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- invoice_items
CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id"          TEXT             NOT NULL,
    "invoiceId"   TEXT             NOT NULL,
    "description" TEXT             NOT NULL,
    "quantity"    INTEGER          NOT NULL,
    "unitPrice"   DOUBLE PRECISION NOT NULL,
    "total"       DOUBLE PRECISION NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- sms_messages
CREATE TABLE IF NOT EXISTS "sms_messages" (
    "id"        TEXT         NOT NULL,
    "clientId"  TEXT,
    "recipient" TEXT         NOT NULL,
    "message"   TEXT         NOT NULL,
    "status"    "SmsStatus"  NOT NULL DEFAULT 'PENDING',
    "type"      "SmsType"    NOT NULL DEFAULT 'INDIVIDUAL',
    "sentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId"  TEXT,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
);

-- message_templates
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id"        TEXT           NOT NULL,
    "name"      TEXT           NOT NULL,
    "content"   TEXT           NOT NULL,
    "type"      "TemplateType" NOT NULL DEFAULT 'CUSTOM',
    "variables" TEXT[],
    "createdAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)   NOT NULL,
    "tenantId"  TEXT,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- payment_channels
CREATE TABLE IF NOT EXISTS "payment_channels" (
    "id"            TEXT            NOT NULL,
    "name"          TEXT            NOT NULL,
    "provider"      TEXT            NOT NULL,
    "accountNumber" TEXT,
    "apiKey"        TEXT,
    "apiSecret"     TEXT,
    "webhookSecret" TEXT,
    "environment"   TEXT            NOT NULL DEFAULT 'sandbox',
    "status"        "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "config"        JSONB,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)    NOT NULL,
    "tenantId"      TEXT,

    CONSTRAINT "payment_channels_pkey" PRIMARY KEY ("id")
);

-- system_settings
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id"       TEXT NOT NULL,
    "key"      TEXT NOT NULL,
    "value"    TEXT NOT NULL,
    "group"    TEXT NOT NULL DEFAULT 'general',
    "tenantId" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- tenant_invoices
CREATE TABLE IF NOT EXISTS "tenant_invoices" (
    "id"            TEXT                   NOT NULL,
    "invoiceNumber" TEXT                   NOT NULL,
    "tenantId"      TEXT                   NOT NULL,
    "planId"        TEXT                   NOT NULL,
    "packageMonths" INTEGER,
    "amount"        DOUBLE PRECISION       NOT NULL,
    "status"        "TenantInvoiceStatus"  NOT NULL DEFAULT 'PENDING',
    "dueDate"       TIMESTAMP(3)           NOT NULL,
    "createdAt"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)           NOT NULL,

    CONSTRAINT "tenant_invoices_pkey" PRIMARY KEY ("id")
);

-- tenant_payments
CREATE TABLE IF NOT EXISTS "tenant_payments" (
    "id"            TEXT            NOT NULL,
    "invoiceId"     TEXT            NOT NULL,
    "tenantId"      TEXT            NOT NULL,
    "amount"        DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT,
    "paymentMethod" TEXT            NOT NULL DEFAULT 'PALMPESA',
    "status"        "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "tenant_payments_pkey" PRIMARY KEY ("id")
);

-- vpn_users
CREATE TABLE IF NOT EXISTS "vpn_users" (
    "id"            TEXT         NOT NULL,
    "username"      TEXT         NOT NULL,
    "password"      TEXT         NOT NULL,
    "fullName"      TEXT,
    "protocol"      TEXT         NOT NULL DEFAULT 'L2TP',
    "profile"       TEXT         NOT NULL DEFAULT 'default',
    "service"       TEXT         NOT NULL DEFAULT 'l2tp',
    "localAddress"  TEXT,
    "remoteAddress" TEXT,
    "status"        TEXT         NOT NULL DEFAULT 'Active',
    "routerId"      TEXT         NOT NULL,
    "uptime"        TEXT,
    "bytesIn"       TEXT,
    "bytesOut"      TEXT,
    "connectedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    "tenantId"      TEXT,

    CONSTRAINT "vpn_users_pkey" PRIMARY KEY ("id")
);

-- radius_users
CREATE TABLE IF NOT EXISTS "radius_users" (
    "id"              TEXT         NOT NULL,
    "username"        TEXT         NOT NULL,
    "password"        TEXT         NOT NULL,
    "fullName"        TEXT,
    "authType"        TEXT         NOT NULL DEFAULT 'PAP',
    "groupName"       TEXT         NOT NULL DEFAULT 'default',
    "status"          TEXT         NOT NULL DEFAULT 'Active',
    "speed"           TEXT,
    "dataLimit"       TEXT,
    "sessionTimeout"  TEXT,
    "simultaneousUse" INTEGER      NOT NULL DEFAULT 1,
    "nasIpAddress"    TEXT,
    "framedIpAddress" TEXT,
    "lastSeen"        TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "tenantId"        TEXT,

    CONSTRAINT "radius_users_pkey" PRIMARY KEY ("id")
);

-- radius_nas
CREATE TABLE IF NOT EXISTS "radius_nas" (
    "id"          TEXT         NOT NULL,
    "nasName"     TEXT         NOT NULL,
    "shortName"   TEXT,
    "type"        TEXT         NOT NULL DEFAULT 'other',
    "ports"       INTEGER      NOT NULL DEFAULT 0,
    "secret"      TEXT         NOT NULL,
    "server"      TEXT,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "tenantId"    TEXT,

    CONSTRAINT "radius_nas_pkey" PRIMARY KEY ("id")
);

-- radcheck (FreeRADIUS)
CREATE TABLE IF NOT EXISTS "radcheck" (
    "id"        SERIAL       NOT NULL,
    "username"  VARCHAR(64)  NOT NULL,
    "attribute" VARCHAR(64)  NOT NULL DEFAULT 'Cleartext-Password',
    "op"        VARCHAR(2)   NOT NULL DEFAULT ':=',
    "value"     VARCHAR(253) NOT NULL,
    "tenantId"  TEXT,

    CONSTRAINT "radcheck_pkey" PRIMARY KEY ("id")
);

-- radacct (FreeRADIUS accounting)
CREATE TABLE IF NOT EXISTS "radacct" (
    "radacctid"          BIGSERIAL    NOT NULL,
    "acctsessionid"      VARCHAR(64)  NOT NULL,
    "acctuniqueid"       VARCHAR(32)  NOT NULL,
    "username"           VARCHAR(64)  NOT NULL,
    "realm"              VARCHAR(64),
    "nasipaddress"       VARCHAR(15)  NOT NULL,
    "nasportid"          VARCHAR(32),
    "nasporttype"        VARCHAR(32),
    "acctstarttime"      TIMESTAMP(3),
    "acctupdatetime"     TIMESTAMP(3),
    "acctstoptime"       TIMESTAMP(3),
    "acctinterval"       INTEGER,
    "acctsessiontime"    INTEGER,
    "acctauthentic"      VARCHAR(32),
    "connectinfo_start"  VARCHAR(120),
    "connectinfo_stop"   VARCHAR(120),
    "acctinputoctets"    BIGINT,
    "acctoutputoctets"   BIGINT,
    "calledstationid"    VARCHAR(50),
    "callingstationid"   VARCHAR(50),
    "acctterminatecause" VARCHAR(32),
    "servicetype"        VARCHAR(32),
    "framedprotocol"     VARCHAR(32),
    "framedipaddress"    VARCHAR(15),
    "tenantId"           TEXT,

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("radacctid")
);

-- radpostauth (FreeRADIUS post-auth logging)
CREATE TABLE IF NOT EXISTS "radpostauth" (
    "id"       BIGSERIAL    NOT NULL,
    "username" VARCHAR(64)  NOT NULL DEFAULT '',
    "pass"     VARCHAR(64)  NOT NULL DEFAULT '',
    "reply"    VARCHAR(32)  NOT NULL DEFAULT '',
    "authdate" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "tenantId" TEXT,

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- radreply (FreeRADIUS reply attributes — Session-Timeout, Rate-Limit)
CREATE TABLE IF NOT EXISTS radreply (
    id        SERIAL       PRIMARY KEY,
    username  VARCHAR(64)  NOT NULL DEFAULT '',
    attribute VARCHAR(64)  NOT NULL,
    op        VARCHAR(2)   NOT NULL DEFAULT '=',
    value     VARCHAR(253) NOT NULL,
    "tenantId" TEXT
);

-- radgroupcheck
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id        SERIAL       PRIMARY KEY,
    groupname VARCHAR(64)  NOT NULL DEFAULT '',
    attribute VARCHAR(64)  NOT NULL,
    op        VARCHAR(2)   NOT NULL DEFAULT ':=',
    value     VARCHAR(253) NOT NULL
);

-- radgroupreply
CREATE TABLE IF NOT EXISTS radgroupreply (
    id        SERIAL       PRIMARY KEY,
    groupname VARCHAR(64)  NOT NULL DEFAULT '',
    attribute VARCHAR(64)  NOT NULL,
    op        VARCHAR(2)   NOT NULL DEFAULT '=',
    value     VARCHAR(253) NOT NULL
);

-- radusergroup
CREATE TABLE IF NOT EXISTS radusergroup (
    id        SERIAL      PRIMARY KEY,
    username  VARCHAR(64) NOT NULL DEFAULT '',
    groupname VARCHAR(64) NOT NULL DEFAULT '',
    priority  INT         NOT NULL DEFAULT 1
);

-- rate_limits
CREATE TABLE IF NOT EXISTS "rate_limits" (
    "id"        TEXT         NOT NULL,
    "key"       TEXT         NOT NULL,
    "count"     INTEGER      NOT NULL DEFAULT 0,
    "resetAt"   TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- webhook_logs
CREATE TABLE IF NOT EXISTS "webhook_logs" (
    "id"             TEXT         NOT NULL,
    "provider"       TEXT         NOT NULL,
    "event"          TEXT         NOT NULL DEFAULT 'PAYMENT_CALLBACK',
    "payload"        JSONB        NOT NULL,
    "headers"        JSONB,
    "signature"      TEXT,
    "verified"       BOOLEAN      NOT NULL DEFAULT false,
    "transactionRef" TEXT,
    "providerRef"    TEXT,
    "status"         TEXT         NOT NULL DEFAULT 'RECEIVED',
    "errorMessage"   TEXT,
    "processedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId"       TEXT,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3: INDEXES
-- ────────────────────────────────────────────────────────────────────────────

-- users
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key"  ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key"     ON "users"("email");
CREATE INDEX        IF NOT EXISTS "users_tenantId_idx"  ON "users"("tenantId");
CREATE INDEX        IF NOT EXISTS "users_role_idx"      ON "users"("role");
CREATE INDEX        IF NOT EXISTS "users_status_idx"    ON "users"("status");

-- clients
CREATE UNIQUE INDEX IF NOT EXISTS "clients_username_key"      ON "clients"("username");
CREATE INDEX        IF NOT EXISTS "clients_tenantId_idx"      ON "clients"("tenantId");
CREATE INDEX        IF NOT EXISTS "clients_status_idx"        ON "clients"("status");
CREATE INDEX        IF NOT EXISTS "clients_serviceType_idx"   ON "clients"("serviceType");
CREATE INDEX        IF NOT EXISTS "clients_createdAt_idx"     ON "clients"("createdAt");

-- packages
CREATE INDEX IF NOT EXISTS "packages_tenantId_idx"  ON "packages"("tenantId");
CREATE INDEX IF NOT EXISTS "packages_type_idx"      ON "packages"("type");
CREATE INDEX IF NOT EXISTS "packages_status_idx"    ON "packages"("status");
CREATE INDEX IF NOT EXISTS "packages_routerId_idx"  ON "packages"("routerId");

-- subscriptions
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_idx"            ON "subscriptions"("tenantId");
CREATE INDEX IF NOT EXISTS "subscriptions_clientId_idx"            ON "subscriptions"("clientId");
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx"              ON "subscriptions"("status");
CREATE INDEX IF NOT EXISTS "subscriptions_expiresAt_idx"           ON "subscriptions"("expiresAt");
CREATE INDEX IF NOT EXISTS "subscriptions_routerId_idx"            ON "subscriptions"("routerId");
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_status_idx"     ON "subscriptions"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_expiresAt_idx"  ON "subscriptions"("tenantId", "expiresAt");

-- transactions
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_reference_key"          ON "transactions"("reference");
CREATE INDEX        IF NOT EXISTS "transactions_tenantId_status_idx"    ON "transactions"("tenantId", "status");
CREATE INDEX        IF NOT EXISTS "transactions_clientId_idx"           ON "transactions"("clientId");
CREATE INDEX        IF NOT EXISTS "transactions_createdAt_idx"          ON "transactions"("createdAt");
CREATE INDEX        IF NOT EXISTS "transactions_status_createdAt_idx"   ON "transactions"("status", "createdAt");
CREATE INDEX        IF NOT EXISTS "transactions_invoiceId_idx"          ON "transactions"("invoiceId");

-- routers
CREATE UNIQUE INDEX IF NOT EXISTS "routers_name_tenantId_key" ON "routers"("name", "tenantId");

-- router_logs (no extra indexes needed beyond FK)

-- hotspot_settings
CREATE UNIQUE INDEX IF NOT EXISTS "hotspot_settings_routerId_key" ON "hotspot_settings"("routerId");

-- equipments
CREATE UNIQUE INDEX IF NOT EXISTS "equipments_serialNumber_key" ON "equipments"("serialNumber");

-- vouchers
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_code_key" ON "vouchers"("code");

-- invoices
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key"  ON "invoices"("invoiceNumber");
CREATE INDEX        IF NOT EXISTS "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");
CREATE INDEX        IF NOT EXISTS "invoices_dueDate_idx"         ON "invoices"("dueDate");
CREATE INDEX        IF NOT EXISTS "invoices_clientId_idx"        ON "invoices"("clientId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_transactionId_key' AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_transactionId_key" UNIQUE ("transactionId");
  END IF;
END $$;

-- system_settings
CREATE UNIQUE INDEX IF NOT EXISTS "system_settings_key_tenantId_key" ON "system_settings"("key", "tenantId");

-- tenants
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_email_key" ON "tenants"("email");

-- tenant_invoices
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invoices_invoiceNumber_key" ON "tenant_invoices"("invoiceNumber");

-- tenant_payments
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_payments_transactionId_key" ON "tenant_payments"("transactionId");

-- vpn_users — composite unique (username + tenantId) badala ya username peke yake
CREATE UNIQUE INDEX IF NOT EXISTS "vpn_users_username_tenantId_key" ON "vpn_users"("username", "tenantId");

-- radius_users — composite unique (username + tenantId)
CREATE UNIQUE INDEX IF NOT EXISTS "radius_users_username_tenantId_key" ON "radius_users"("username", "tenantId");
CREATE INDEX        IF NOT EXISTS "radius_users_tenantId_idx"          ON "radius_users"("tenantId");

-- radius_nas
CREATE INDEX IF NOT EXISTS "radius_nas_tenantId_idx"          ON "radius_nas"("tenantId");
CREATE INDEX IF NOT EXISTS "radius_nas_nasName_tenantId_idx"  ON "radius_nas"("nasName", "tenantId");

-- radcheck
CREATE INDEX        IF NOT EXISTS "radcheck_username_idx"           ON "radcheck"("username");
CREATE INDEX        IF NOT EXISTS "radcheck_tenantId_idx"           ON "radcheck"("tenantId");
CREATE INDEX        IF NOT EXISTS "radcheck_tenantId_username_idx"  ON "radcheck"("tenantId", "username");
CREATE UNIQUE INDEX IF NOT EXISTS "username_tenantId_attribute"     ON "radcheck"("username", "tenantId", "attribute");

-- radacct
CREATE UNIQUE INDEX IF NOT EXISTS "radacct_acctuniqueid_key"              ON "radacct"("acctuniqueid");
CREATE INDEX        IF NOT EXISTS "radacct_username_idx"                   ON "radacct"("username");
CREATE INDEX        IF NOT EXISTS "radacct_acctsessionid_idx"              ON "radacct"("acctsessionid");
CREATE INDEX        IF NOT EXISTS "radacct_acctstarttime_idx"              ON "radacct"("acctstarttime");
CREATE INDEX        IF NOT EXISTS "radacct_acctstoptime_idx"               ON "radacct"("acctstoptime");
CREATE INDEX        IF NOT EXISTS "radacct_nasipaddress_idx"               ON "radacct"("nasipaddress");
CREATE INDEX        IF NOT EXISTS "radacct_tenantId_idx"                   ON "radacct"("tenantId");
CREATE INDEX        IF NOT EXISTS "radacct_tenantId_acctstoptime_idx"      ON "radacct"("tenantId", "acctstoptime");
CREATE INDEX        IF NOT EXISTS "radacct_tenantId_username_idx"          ON "radacct"("tenantId", "username");
CREATE INDEX        IF NOT EXISTS "radacct_tenantId_acctstarttime_idx"     ON "radacct"("tenantId", "acctstarttime");
CREATE INDEX        IF NOT EXISTS "radacct_nasipaddress_acctstoptime_idx"  ON "radacct"("nasipaddress", "acctstoptime");

-- radpostauth
CREATE INDEX IF NOT EXISTS "radpostauth_username_idx" ON "radpostauth"("username");
CREATE INDEX IF NOT EXISTS "radpostauth_tenantId_idx" ON "radpostauth"("tenantId");

-- radreply
CREATE INDEX        IF NOT EXISTS "idx_radreply_username"   ON radreply(username);
CREATE INDEX        IF NOT EXISTS "idx_radreply_tenantid"   ON radreply("tenantId");
CREATE INDEX        IF NOT EXISTS "idx_radreply_tenant_usr" ON radreply("tenantId", username);
CREATE UNIQUE INDEX IF NOT EXISTS "radreply_username_tenantId_attribute" ON radreply(username, "tenantId", attribute);

-- radgroupcheck / radgroupreply / radusergroup
CREATE INDEX IF NOT EXISTS "idx_radgroupcheck_groupname"  ON radgroupcheck(groupname);
CREATE INDEX IF NOT EXISTS "idx_radgroupreply_groupname"  ON radgroupreply(groupname);
CREATE INDEX IF NOT EXISTS "idx_radusergroup_username"    ON radusergroup(username);

-- rate_limits
CREATE INDEX        IF NOT EXISTS "rate_limits_resetAt_idx" ON "rate_limits"("resetAt");
CREATE UNIQUE INDEX IF NOT EXISTS "rate_limits_key_key"     ON "rate_limits"("key");

-- webhook_logs
CREATE INDEX IF NOT EXISTS "webhook_logs_provider_idx"       ON "webhook_logs"("provider");
CREATE INDEX IF NOT EXISTS "webhook_logs_transactionRef_idx" ON "webhook_logs"("transactionRef");
CREATE INDEX IF NOT EXISTS "webhook_logs_providerRef_idx"    ON "webhook_logs"("providerRef");
CREATE INDEX IF NOT EXISTS "webhook_logs_tenantId_idx"       ON "webhook_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "webhook_logs_createdAt_idx"      ON "webhook_logs"("createdAt");


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4: FOREIGN KEYS (idempotent — salama ku-run mara nyingi)
-- ────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "user_otps" ADD CONSTRAINT "user_otps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "packages" ADD CONSTRAINT "packages_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "packages" ADD CONSTRAINT "packages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "transactions" ADD CONSTRAINT "transactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "routers" ADD CONSTRAINT "routers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "router_logs" ADD CONSTRAINT "router_logs_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "router_logs" ADD CONSTRAINT "router_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "hotspot_settings" ADD CONSTRAINT "hotspot_settings_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "hotspot_settings" ADD CONSTRAINT "hotspot_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "equipments" ADD CONSTRAINT "equipments_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "equipments" ADD CONSTRAINT "equipments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "tenant_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "vpn_users" ADD CONSTRAINT "vpn_users_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "vpn_users" ADD CONSTRAINT "vpn_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "radius_users" ADD CONSTRAINT "radius_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "radius_nas" ADD CONSTRAINT "radius_nas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "radcheck" ADD CONSTRAINT "radcheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "radacct" ADD CONSTRAINT "radacct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "radpostauth" ADD CONSTRAINT "radpostauth_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 5: TRIGGERS (Multi-Tenant RADIUS Auto-Assignment)
-- ────────────────────────────────────────────────────────────────────────────

-- Trigger 1: Auto-assign tenantId on radacct INSERT
CREATE OR REPLACE FUNCTION assign_radacct_tenant()
RETURNS TRIGGER AS $$
BEGIN
    SELECT r."tenantId" INTO NEW."tenantId"
    FROM routers r
    WHERE (r.host = NEW.nasipaddress OR r."wgTunnelIp" = NEW.nasipaddress)
      AND r."tenantId" IS NOT NULL
    LIMIT 1;

    IF NEW."tenantId" IS NULL THEN
        SELECT rn."tenantId" INTO NEW."tenantId"
        FROM radius_nas rn
        WHERE rn."nasName" = NEW.nasipaddress
          AND rn."tenantId" IS NOT NULL
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_radacct_tenant ON radacct;
CREATE TRIGGER trg_radacct_tenant
    BEFORE INSERT ON radacct
    FOR EACH ROW
    EXECUTE FUNCTION assign_radacct_tenant();

-- Trigger 2: Auto-assign tenantId on radcheck INSERT
CREATE OR REPLACE FUNCTION assign_radcheck_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id TEXT;
BEGIN
    IF NEW."tenantId" IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT ru."tenantId" INTO v_tenant_id
    FROM radius_users ru
    WHERE ru.username = NEW.username
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
        NEW."tenantId" := v_tenant_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_radcheck_tenant ON radcheck;
CREATE TRIGGER trg_radcheck_tenant
    BEFORE INSERT ON radcheck
    FOR EACH ROW
    EXECUTE FUNCTION assign_radcheck_tenant();


-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 6: VERIFY (optional — cheki triggers)
-- ────────────────────────────────────────────────────────────────────────────

SELECT tgname, tgrelid::regclass, tgtype
FROM pg_trigger
WHERE tgname IN ('trg_radacct_tenant', 'trg_radcheck_tenant');

-- ============================================================================
-- MWISHO — Schema imekamilika. Tables zote ziko tupu, ziko tayari kutumika.
-- ============================================================================
