-- Migration: add_radreply_and_radius_groups
-- Adds the missing FreeRADIUS tables: radreply, radgroupcheck, radgroupreply, radusergroup
-- These are REQUIRED for MikroTik to receive Session-Timeout and Rate-Limit attributes.
--
-- Run manually on the Droplet if Prisma migrate is unavailable:
--   PGPASSWORD=<password> psql -h localhost -p 5444 -U <user> -d <db> -f this_file.sql

-- ── radreply ──────────────────────────────────────────────────────────────────
-- FreeRADIUS sends these attributes back to MikroTik on Access-Accept.
-- CRITICAL: Session-Timeout MUST be here for MikroTik to allow the session.
CREATE TABLE IF NOT EXISTS radreply (
    id         SERIAL        PRIMARY KEY,
    username   VARCHAR(64)   NOT NULL DEFAULT '',
    attribute  VARCHAR(64)   NOT NULL,
    op         VARCHAR(2)    NOT NULL DEFAULT '=',
    value      VARCHAR(253)  NOT NULL,
    "tenantId" TEXT
);
CREATE INDEX IF NOT EXISTS idx_radreply_username   ON radreply(username);
CREATE INDEX IF NOT EXISTS idx_radreply_tenantid   ON radreply("tenantId");
CREATE INDEX IF NOT EXISTS idx_radreply_tenant_usr ON radreply("tenantId", username);

-- ── radgroupcheck ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id         SERIAL       PRIMARY KEY,
    groupname  VARCHAR(64)  NOT NULL DEFAULT '',
    attribute  VARCHAR(64)  NOT NULL,
    op         VARCHAR(2)   NOT NULL DEFAULT ':=',
    value      VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radgroupcheck_groupname ON radgroupcheck(groupname);

-- ── radgroupreply ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupreply (
    id         SERIAL       PRIMARY KEY,
    groupname  VARCHAR(64)  NOT NULL DEFAULT '',
    attribute  VARCHAR(64)  NOT NULL,
    op         VARCHAR(2)   NOT NULL DEFAULT '=',
    value      VARCHAR(253) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radgroupreply_groupname ON radgroupreply(groupname);

-- ── radusergroup ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radusergroup (
    id         SERIAL      PRIMARY KEY,
    username   VARCHAR(64) NOT NULL DEFAULT '',
    groupname  VARCHAR(64) NOT NULL DEFAULT '',
    priority   INT         NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_radusergroup_username ON radusergroup(username);

-- ── Ensure radpostauth exists (in case prior migration failed) ────────────────
CREATE TABLE IF NOT EXISTS radpostauth (
    id         BIGSERIAL    PRIMARY KEY,
    username   VARCHAR(64)  NOT NULL DEFAULT '',
    pass       VARCHAR(64)  NOT NULL DEFAULT '',
    reply      VARCHAR(32)  NOT NULL DEFAULT '',
    authdate   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "tenantId" TEXT
);
CREATE INDEX IF NOT EXISTS idx_radpostauth_username ON radpostauth(username);
CREATE INDEX IF NOT EXISTS idx_radpostauth_tenantid ON radpostauth("tenantId");

-- ── Mark in Prisma migrations table ──────────────────────────────────────────
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    'manual-add-radreply-and-radius-groups',
    NOW(),
    '20260512_add_radreply_and_radius_groups',
    NULL,
    NULL,
    NOW(),
    1
) ON CONFLICT DO NOTHING;
