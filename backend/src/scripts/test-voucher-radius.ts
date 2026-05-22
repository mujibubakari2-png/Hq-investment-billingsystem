/**
 * test-voucher-radius.ts
 *
 * Tests the complete Voucher ↔ RADIUS integration:
 *  1. Generate a voucher via POST /api/vouchers
 *  2. Redeem the voucher via POST /api/hotspot/voucher/redeem
 *  3. Verify subscription → ACTIVE + RADIUS user synced
 *  4. Preview expired voucher subs via GET /api/radius/voucher-expire
 *  5. Manually expire the subscription in DB
 *  6. POST /api/radius/voucher-expire — trigger expiry processing
 *  7. Verify subscription → EXPIRED + RADIUS user suspended
 *  8. Cleanup
 */

import "dotenv/config";
import prisma from "../lib/prisma";
import {
  TestSuite,
  SuiteResult,
  apiFetch,
  makeAdminToken,
  info,
  warn,
  cleanupByUsername,
} from "./test-helpers";

const TEST_TENANT = "test-tenant-hq-001";
const TEST_MAC = "AA:BB:CC:DD:EE:02";
const TEST_VOUCHER_CODE = `TESTVOUCHER${Date.now()}`;

export async function runVoucherRadiusTests(): Promise<SuiteResult> {
  const suite = new TestSuite("Voucher + RADIUS Integration (Generate → Redeem → Expire)");
  const token = makeAdminToken(TEST_TENANT);

  // ── Find active package and router ────────────────────────────────────────
  info("Looking for an active package...");
  const pkg = await prisma.package.findFirst({
    where: { status: "ACTIVE" },
    include: { router: true },
  });

  if (!pkg) {
    suite.skip("All voucher tests", "No active packages found");
    return suite.getResult();
  }

  info(`Using package: "${pkg.name}" (${pkg.duration} ${pkg.durationUnit})`);

  // ── Find an admin user to use as createdBy ─────────────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
  });

  if (!adminUser) {
    suite.skip("All voucher tests", "No admin user found to create vouchers");
    return suite.getResult();
  }

  // ── Pre-cleanup ────────────────────────────────────────────────────────────
  await prisma.voucher.deleteMany({ where: { code: TEST_VOUCHER_CODE } });

  let createdVoucherId: string | null = null;
  let testClientId: string | null = null;
  let testUsername: string | null = null;

  // ── 1. Create a voucher ────────────────────────────────────────────────────
  info("Creating test voucher...");
  const createRes = await apiFetch("/api/vouchers", {
    method: "POST",
    token,
    body: {
      code: TEST_VOUCHER_CODE,
      packageId: pkg.id,
      routerId: pkg.routerId || null,
      createdById: adminUser.id,
    },
  });

  suite.assert(
    createRes.status === 201 || createRes.status === 200,
    `POST /api/vouchers returns 201 (got ${createRes.status})`
  );

  if (createRes.ok && createRes.data?.id) {
    createdVoucherId = createRes.data.id;
    suite.assertDefined(createdVoucherId, "Voucher has an ID");
    suite.assertEqual(createRes.data.status, "UNUSED", "New voucher status = UNUSED");
    info(`Created voucher: ${TEST_VOUCHER_CODE} (ID: ${createdVoucherId})`);
  } else {
    suite.assert(false, "POST /api/vouchers returned voucher data", JSON.stringify(createRes.data));
  }

  // ── 2. Verify voucher appears in list ─────────────────────────────────────
  info("Verifying voucher in list...");
  const listRes = await apiFetch(`/api/vouchers?search=${TEST_VOUCHER_CODE}`, { token });
  if (listRes.ok) {
    const found = listRes.data.data?.some((v: any) => v.code === TEST_VOUCHER_CODE);
    suite.assert(found, "Voucher appears in /api/vouchers list");
  } else {
    suite.skip("Voucher list verification", `List returned ${listRes.status}`);
  }

  // ── 3. Redeem the voucher ─────────────────────────────────────────────────
  info("Redeeming voucher on hotspot...");
  const redeemRes = await fetch(
    `${process.env.TEST_BASE_URL || "http://localhost:3000"}/api/hotspot/voucher/redeem`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: TEST_VOUCHER_CODE,
        macAddress: TEST_MAC,
        routerId: pkg.routerId || "",
      }),
    }
  );
  const redeemData = await redeemRes.json();

  suite.assert(
    redeemRes.status === 200 || redeemRes.status === 201,
    `POST /api/hotspot/voucher/redeem returns 200 (got ${redeemRes.status})`
  );

  if (redeemRes.ok) {
    testUsername = redeemData.username || null;
    testClientId = redeemData.clientId || null;
    suite.assertDefined(testUsername, "Redeem response has username");
    suite.assertDefined(redeemData.expiresAt, "Redeem response has expiresAt");
    info(`Redeemed for user: ${testUsername}, expires: ${redeemData.expiresAt}`);
  } else {
    suite.assert(false, "Voucher redeem succeeded", JSON.stringify(redeemData));
  }

  // Short wait for DB writes
  await new Promise((r) => setTimeout(r, 300));

  // ── 4. Verify voucher is now USED ─────────────────────────────────────────
  info("Verifying voucher marked as USED...");
  const usedVoucher = await prisma.voucher.findFirst({ where: { code: TEST_VOUCHER_CODE } });
  suite.assert(
    usedVoucher?.status === "USED",
    `Voucher status = USED (got ${usedVoucher?.status})`
  );
  suite.assertDefined(usedVoucher?.usedAt, "Voucher has usedAt timestamp");

  // ── 5. Verify subscription ACTIVE ─────────────────────────────────────────
  info("Verifying subscription created and ACTIVE...");
  const sub = testClientId
    ? await prisma.subscription.findFirst({
        where: { clientId: testClientId, status: "ACTIVE", method: "VOUCHER" },
      })
    : await prisma.subscription.findFirst({
        where: { status: "ACTIVE", method: "VOUCHER", packageId: pkg.id },
        orderBy: { activatedAt: "desc" },
      });

  suite.assertDefined(sub, "VOUCHER subscription created");
  suite.assertEqual(sub?.method, "VOUCHER", "Subscription method = VOUCHER");
  const expiry = sub?.expiresAt ? new Date(sub.expiresAt) : null;
  suite.assert(expiry !== null && expiry > new Date(), "Subscription expiresAt is in the future");

  // ── 6. Verify RADIUS synced ────────────────────────────────────────────────
  info("Verifying RADIUS tables populated after redeem...");
  if (testUsername) {
    const pwRow = await prisma.radCheck.findFirst({
      where: { username: testUsername, attribute: "Cleartext-Password" },
    });
    suite.assertDefined(pwRow, `radcheck: Cleartext-Password set for ${testUsername}`);

    const stRow = await prisma.radReply.findFirst({
      where: { username: testUsername, attribute: "Session-Timeout" },
    });
    suite.assertDefined(stRow, `radreply: Session-Timeout set for ${testUsername}`);
    const stVal = parseInt(stRow?.value || "0");
    suite.assert(stVal > 0, `radreply: Session-Timeout > 0 (got ${stVal}s)`);
  } else {
    suite.skip("RADIUS verification", "No username from redeem response");
  }

  // ── 7. Preview expired voucher subs (should be 0 now) ─────────────────────
  info("Previewing expired voucher subscriptions (expect 0)...");
  const previewRes = await apiFetch("/api/radius/voucher-expire", { token });
  suite.assert(previewRes.status === 200, `GET /api/radius/voucher-expire returns 200 (got ${previewRes.status})`);
  if (previewRes.ok) {
    info(`Expired voucher subs found: ${previewRes.data.count}`);
  }

  // ── 8. Manually expire the subscription ───────────────────────────────────
  info("Force-expiring the test subscription in DB...");
  if (sub?.id) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { expiresAt: new Date(Date.now() - 60_000) }, // 1 minute ago
    });
    info("Subscription expiresAt set to the past ✓");
  }

  // ── 9. POST /api/radius/voucher-expire — trigger processing ───────────────
  info("Triggering voucher-expire endpoint...");
  const expireRes = await apiFetch("/api/radius/voucher-expire", {
    method: "POST",
    token,
  });
  suite.assert(
    expireRes.status === 200,
    `POST /api/radius/voucher-expire returns 200 (got ${expireRes.status})`
  );

  if (expireRes.ok) {
    suite.assert(expireRes.data.success === true, "voucher-expire response: success = true");
    suite.assert(
      expireRes.data.processed >= 1,
      `voucher-expire processed >= 1 sub (got ${expireRes.data.processed})`
    );
    info(`Processed: ${expireRes.data.processed}, succeeded: ${expireRes.data.succeeded}, failed: ${expireRes.data.failed}`);
  }

  // Small wait for DB writes
  await new Promise((r) => setTimeout(r, 300));

  // ── 10. Verify subscription → EXPIRED ─────────────────────────────────────
  info("Verifying subscription status = EXPIRED...");
  if (sub?.id) {
    const expiredSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
    suite.assertEqual(expiredSub?.status, "EXPIRED", "Subscription status = EXPIRED");
    suite.assertEqual(expiredSub?.onlineStatus, "OFFLINE", "Subscription onlineStatus = OFFLINE");
  }

  // ── 11. Verify RADIUS user suspended ──────────────────────────────────────
  info("Verifying RADIUS user suspended (Expiration in the past)...");
  if (testUsername) {
    const radiusUser = await prisma.radiusUser.findFirst({
      where: { username: testUsername },
    });
    suite.assertEqual(radiusUser?.status, "Inactive", `RadiusUser status = Inactive for ${testUsername}`);

    const expRow = await prisma.radCheck.findFirst({
      where: { username: testUsername, attribute: "Expiration" },
    });
    suite.assertDefined(expRow, "radcheck: Expiration still exists");
    // Expiration value should be a date in the past
    const expYear = parseInt(expRow?.value?.split(" ")[2] || "9999");
    suite.assert(expYear <= new Date().getFullYear(), "radcheck: Expiration year is not in the future (user is blocked)");

    // Session-Timeout must be removed
    const stRowAfter = await prisma.radReply.findFirst({
      where: { username: testUsername, attribute: "Session-Timeout" },
    });
    suite.assert(stRowAfter === null, "radreply: Session-Timeout removed (user is blocked)");
  }

  // ── 12. Cleanup ────────────────────────────────────────────────────────────
  info("Cleaning up test voucher data...");
  try {
    if (testUsername) await cleanupByUsername(testUsername, null);
    if (sub?.id) await prisma.subscription.deleteMany({ where: { id: sub.id } });
    await prisma.voucher.deleteMany({ where: { code: TEST_VOUCHER_CODE } });
    if (testClientId) {
      await prisma.transaction.deleteMany({ where: { clientId: testClientId } });
      await prisma.client.deleteMany({ where: { id: testClientId } });
    }
    info("Cleanup done ✓");
  } catch (e: any) {
    warn(`Cleanup warning: ${e.message}`);
  }

  return suite.getResult();
}

// ── Run standalone ────────────────────────────────────────────────────────────
if (require.main === module) {
  runVoucherRadiusTests()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
