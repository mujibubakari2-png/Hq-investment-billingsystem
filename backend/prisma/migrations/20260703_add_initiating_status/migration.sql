-- Migration: 20260703_add_initiating_transaction_status
-- Purpose: Add INITIATING to TransactionStatus enum to support atomic TOCTOU prevention
-- in the payment initiation flow (payments/initiate/route.ts).
--
-- The INITIATING status acts as an optimistic lock:
--   1. updateMany({where: {status: PENDING}}) → {status: INITIATING}  ← atomic claim
--   2. Call payment gateway
--   3. On success: update to PENDING (provider accepted) 
--   4. On failure: rollback to PENDING (allow retry)
-- Only one concurrent request wins the updateMany race — others get 0 rows updated → 409.

-- PostgreSQL: Add enum value (cannot be done inside a transaction)
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'INITIATING';
