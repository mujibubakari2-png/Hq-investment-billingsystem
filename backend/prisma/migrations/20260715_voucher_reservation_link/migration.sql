-- VOUCHER-RESERVE-001
-- Links subscriptions back to the voucher that created them, so a background
-- sweep can confirm (first real RADIUS auth seen) or release (grace period
-- expired with no auth) a voucher reservation.

ALTER TABLE "subscriptions" ADD COLUMN "voucherId" TEXT;

CREATE INDEX "subscriptions_voucherId_idx" ON "subscriptions"("voucherId");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
