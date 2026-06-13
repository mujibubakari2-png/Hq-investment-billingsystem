-- ============================================================================
-- RAD-002: Backfill radcheck — migrate Cleartext-Password → MD5-Password
-- ============================================================================
--
-- This migration converts existing radcheck rows that store passwords as
-- Cleartext-Password into MD5-Password rows so they are compatible with
-- FreeRADIUS pap module after the RAD-002 code change in radius.ts.
--
-- HOW IT WORKS:
--   PostgreSQL's md5() function returns a hex string identical to what
--   Node's crypto.createHash('md5').update(password).digest('hex') produces.
--   FreeRADIUS pap module:
--     - Reads MD5-Password from radcheck
--     - MD5-hashes the incoming PAP password
--     - Compares to stored hash
--
-- IMPORTANT:
--   • Run AFTER deploying the radius.ts code change.
--   • Run during a maintenance window — FreeRADIUS will not authenticate
--     during the brief period between old rows being deleted and new ones
--     being inserted (the DO block is transactional, so it is atomic).
--   • After running, verify with: SELECT COUNT(*) FROM radcheck WHERE attribute = 'MD5-Password';
--   • Cleartext-Password rows are removed — BACK UP radcheck first if needed.
-- ============================================================================

BEGIN;

-- Step 1: Insert MD5-Password rows for all existing Cleartext-Password entries.
-- Uses ON CONFLICT to safely handle any rows that were already migrated.
INSERT INTO radcheck (username, attribute, op, value, "tenantId")
SELECT
    username,
    'MD5-Password'  AS attribute,
    ':='            AS op,
    md5(value)      AS value,   -- PostgreSQL md5() = hex(MD5(input)) ✓
    "tenantId"
FROM radcheck
WHERE attribute = 'Cleartext-Password'
ON CONFLICT ON CONSTRAINT "username_tenantId_attribute"
DO UPDATE SET value = EXCLUDED.value, op = EXCLUDED.op;

-- Step 2: Remove all Cleartext-Password rows (plaintext passwords at rest)
DELETE FROM radcheck WHERE attribute = 'Cleartext-Password';

-- Verification query (review before committing):
-- SELECT attribute, COUNT(*) FROM radcheck GROUP BY attribute ORDER BY attribute;

COMMIT;
