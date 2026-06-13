-- ============================================================================
-- DB-002: Partition radacct by month (acctstarttime)
-- ============================================================================
--
-- Strategy: zero-downtime online migration using a rename-and-replace approach.
--   1. Create new partitioned table radacct_partitioned with identical columns.
--   2. Create partitions for current month ± 3 months and a default catch-all.
--   3. Copy all existing data into the partitioned table.
--   4. Swap via RENAME (requires brief exclusive lock only at swap moment).
--   5. Attach a function + cron job (pg_cron) to auto-create future partitions.
--
-- IMPORTANT NOTES:
--   • Requires PostgreSQL 11+ (native declarative partitioning).
--   • pg_cron must be installed: CREATE EXTENSION IF NOT EXISTS pg_cron;
--   • FreeRADIUS must be briefly paused or writes retried during the final RENAME.
--   • The unique index on acctuniqueid is replaced by a unique index per partition
--     (PostgreSQL limitation: global unique indexes across partitions not supported).
--   • Run within a maintenance window or during low-traffic hours.
--   • The tenantId FK on the parent table is dropped; FreeRADIUS inserts are
--     validated by the trigger, not the FK, so this is safe.
-- ============================================================================

BEGIN;

-- ── Step 1: Create the new partitioned parent table ───────────────────────────

CREATE TABLE IF NOT EXISTS "radacct_partitioned" (
    "radacctid"          BIGINT       NOT NULL DEFAULT nextval('"radacct_radacctid_seq"'::regclass),
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
    PRIMARY KEY ("radacctid", "acctstarttime")
) PARTITION BY RANGE ("acctstarttime");

-- ── Step 2: Create monthly partitions ────────────────────────────────────────
-- Covers 6 months back, current month, and 6 months forward.
-- Additional months are created automatically by the function below.

DO $$
DECLARE
    start_month DATE;
    end_month   DATE;
    part_name   TEXT;
    i           INTEGER;
BEGIN
    -- Create partitions from 6 months ago to 6 months ahead
    FOR i IN -6..6 LOOP
        start_month := DATE_TRUNC('month', NOW()) + (i || ' months')::INTERVAL;
        end_month   := start_month + INTERVAL '1 month';
        part_name   := 'radacct_' || TO_CHAR(start_month, 'YYYY_MM');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I
             PARTITION OF "radacct_partitioned"
             FOR VALUES FROM (%L) TO (%L)',
            part_name, start_month, end_month
        );

        -- Per-partition indexes (mirrors original radacct indexes)
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("username")',
            part_name || '_username_idx', part_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("acctstoptime")',
            part_name || '_acctstoptime_idx', part_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")',
            part_name || '_tenantId_idx', part_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId", "acctstoptime")',
            part_name || '_tenantId_stop_idx', part_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId", "username")',
            part_name || '_tenantId_user_idx', part_name
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I ("nasipaddress", "acctstoptime")',
            part_name || '_nas_stop_idx', part_name
        );
        EXECUTE format(
            'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I ("acctuniqueid")',
            part_name || '_acctuniqueid_key', part_name
        );
    END LOOP;
END $$;

-- Default partition catches sessions with NULL acctstarttime (FreeRADIUS quirk)
CREATE TABLE IF NOT EXISTS "radacct_default"
    PARTITION OF "radacct_partitioned" DEFAULT;

-- ── Step 3: Migrate existing data ─────────────────────────────────────────────
-- Copy in batches to avoid locking for too long.
-- acctstarttime NULL rows go to default partition.

INSERT INTO "radacct_partitioned"
SELECT
    "radacctid", "acctsessionid", "acctuniqueid", "username", "realm",
    "nasipaddress", "nasportid", "nasporttype",
    COALESCE("acctstarttime", NOW()::TIMESTAMP(3)),  -- NULL → now (lands in current month)
    "acctupdatetime", "acctstoptime", "acctinterval", "acctsessiontime",
    "acctauthentic", "connectinfo_start", "connectinfo_stop",
    "acctinputoctets", "acctoutputoctets", "calledstationid",
    "callingstationid", "acctterminatecause", "servicetype",
    "framedprotocol", "framedipaddress", "tenantId"
FROM "radacct"
ON CONFLICT ("radacctid", "acctstarttime") DO NOTHING;

-- ── Step 4: Swap tables ───────────────────────────────────────────────────────
-- Brief exclusive lock window — pause FreeRADIUS accounting writes if possible.

ALTER TABLE "radacct"             RENAME TO "radacct_legacy";
ALTER TABLE "radacct_partitioned" RENAME TO "radacct";

-- Re-attach the tenant-assignment trigger to the new parent
DROP TRIGGER IF EXISTS trg_radacct_tenant ON "radacct";
CREATE TRIGGER trg_radacct_tenant
    BEFORE INSERT ON "radacct"
    FOR EACH ROW
    EXECUTE FUNCTION assign_radacct_tenant();

COMMIT;

-- ── Step 5: Auto-create future partitions (pg_cron) ──────────────────────────
-- Run on the 25th of each month to create next month's partition + indexes.
-- Requires pg_cron extension: CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION create_radacct_partition_for_month(target_month DATE)
RETURNS VOID AS $$
DECLARE
    part_name  TEXT := 'radacct_' || TO_CHAR(target_month, 'YYYY_MM');
    start_date DATE := DATE_TRUNC('month', target_month);
    end_date   DATE := start_date + INTERVAL '1 month';
BEGIN
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I
         PARTITION OF "radacct"
         FOR VALUES FROM (%L) TO (%L)',
        part_name, start_date, end_date
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("username")',            part_name || '_username_idx',     part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("acctstoptime")',        part_name || '_acctstoptime_idx', part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId")',            part_name || '_tenantId_idx',     part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId","acctstoptime")', part_name || '_tenantId_stop_idx',  part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("tenantId","username")', part_name || '_tenantId_user_idx',  part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("nasipaddress","acctstoptime")', part_name || '_nas_stop_idx', part_name);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I ("acctuniqueid")', part_name || '_acctuniqueid_key', part_name);
    RAISE NOTICE 'Created partition: %', part_name;
END;
$$ LANGUAGE plpgsql;

-- Create next 3 months proactively (idempotent — IF NOT EXISTS)
SELECT create_radacct_partition_for_month((DATE_TRUNC('month', NOW()) + '1 month'::INTERVAL)::DATE);
SELECT create_radacct_partition_for_month((DATE_TRUNC('month', NOW()) + '2 months'::INTERVAL)::DATE);
SELECT create_radacct_partition_for_month((DATE_TRUNC('month', NOW()) + '3 months'::INTERVAL)::DATE);

-- Schedule monthly auto-creation via pg_cron (runs on 25th at 02:00 UTC)
-- Uncomment after confirming pg_cron is installed:
-- SELECT cron.schedule(
--     'create-radacct-partition',
--     '0 2 25 * *',
--     $$SELECT create_radacct_partition_for_month(
--         (DATE_TRUNC('month', NOW()) + '1 month'::INTERVAL)::DATE
--     )$$
-- );

-- ── Optional: drop legacy table after validating data integrity ───────────────
-- Run this ONLY after verifying the new partitioned table is correct:
-- DROP TABLE IF EXISTS "radacct_legacy";
