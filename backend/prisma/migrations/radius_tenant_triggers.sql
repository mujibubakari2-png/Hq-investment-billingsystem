-- ============================================================================
-- Multi-Tenant RADIUS Auto-Assignment Triggers
-- ============================================================================
-- These triggers automatically assign tenantId to incoming RADIUS records
-- based on the NAS IP → Router → Tenant mapping chain.
-- Run this SQL directly against your PostgreSQL database.
-- ============================================================================

-- ─── Trigger 1: Auto-assign tenantId on radacct INSERT ──────────────────────
-- When FreeRADIUS inserts an accounting record, look up the tenant
-- from the routers table using the NAS IP address.

CREATE OR REPLACE FUNCTION assign_radacct_tenant()
RETURNS TRIGGER AS $$
BEGIN
    -- Step 1: Try to find tenant from routers table (primary mapping)
    SELECT r."tenantId" INTO NEW."tenantId"
    FROM routers r
    WHERE r.host = NEW.nasipaddress
    LIMIT 1;

    -- Step 2: Fallback to radius_nas table if router not found
    IF NEW."tenantId" IS NULL THEN
        SELECT rn."tenantId" INTO NEW."tenantId"
        FROM radius_nas rn
        WHERE rn."nasName" = NEW.nasipaddress
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trg_radacct_tenant ON radacct;
CREATE TRIGGER trg_radacct_tenant
    BEFORE INSERT ON radacct
    FOR EACH ROW
    EXECUTE FUNCTION assign_radacct_tenant();


-- ─── Trigger 2: Auto-assign tenantId on radcheck INSERT ─────────────────────
-- When FreeRADIUS inserts an auth-check record, look up the tenant
-- from the radius_users table using the username.

CREATE OR REPLACE FUNCTION assign_radcheck_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id TEXT;
BEGIN
    -- Only assign if tenantId is not already set
    IF NEW."tenantId" IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Look up tenant from radius_users matching the username
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

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trg_radcheck_tenant ON radcheck;
CREATE TRIGGER trg_radcheck_tenant
    BEFORE INSERT ON radcheck
    FOR EACH ROW
    EXECUTE FUNCTION assign_radcheck_tenant();


-- ─── Verify triggers are installed ──────────────────────────────────────────
SELECT tgname, tgrelid::regclass, tgtype
FROM pg_trigger
WHERE tgname IN ('trg_radacct_tenant', 'trg_radcheck_tenant');
