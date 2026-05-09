-- Migration: add_radpostauth_table
-- Adds radpostauth table required by FreeRADIUS for post-authentication logging
-- FreeRADIUS logs every Access-Accept / Access-Reject here

CREATE TABLE IF NOT EXISTS "radpostauth" (
    "id"       BIGSERIAL    NOT NULL,
    "username" VARCHAR(64)  NOT NULL DEFAULT '',
    "pass"     VARCHAR(64)  NOT NULL DEFAULT '',
    "reply"    VARCHAR(32)  NOT NULL DEFAULT '',
    "authdate" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "tenantId" TEXT,

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- Indexes for fast lookups by username and tenant
CREATE INDEX IF NOT EXISTS "radpostauth_username_idx"  ON "radpostauth"("username");
CREATE INDEX IF NOT EXISTS "radpostauth_tenantId_idx"  ON "radpostauth"("tenantId");

-- Foreign key to tenants table
ALTER TABLE "radpostauth"
    ADD CONSTRAINT "radpostauth_tenantId_fkey"
    FOREIGN KEY ("tenantId")
    REFERENCES "tenants"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
