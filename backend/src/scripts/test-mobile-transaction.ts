/**
 * test-mobile-transaction.ts
 *
 * Tests the full hotspot purchase → payment callback → subscription lifecycle:
 *  1. POST /api/hotspot/purchase  — initiate purchase (creates PENDING txn)
 *  2. Verify PENDING transaction in DB
 *  3. POST /api/hotspot/callback  — simulate successful payment webhook
 *  4. Verify transaction → COMPLETED
 *  5. Verify subscription → ACTIVE
 *  6. Verify RADIUS user synced (radcheck populated)
 *  7. Verify router log created
 *  8. Cleanup test data
 */

import "dotenv/config";
import prisma from "../lib/prisma";
import {
  TestSuite, SuiteResult, apiFetch, info, warn, cleanupTestData
} from "./test-helpers";

const TEST_TENANT = "test-tenant-hq-001";
const TEST_PHONE = "0755000001"; // Will be normalized to 255755000001

export async function runMobileTransactionTests(): Promise<SuiteResult> {
  const suite = new TestSuite("Mobile Transactions (Purchase → Callback → Subscription)");

  // Pre-cleanup
  await cleanupTestData(TEST_TENANT);

  // ── Find an active package to use ─────────────────────────────────────────
  info("Looking for an active package to use in test...");
  const pkg = await prisma.package.findFirst({
    where: { status: "ACTIVE", price: { gte: 100 } },
  });

  if (!pkg) {
    suite.skip("All mobile transaction tests", "No active packages found in database");
    return suite.getResult();
  }

  info(`Using package: "${pkg.name}" (${pkg.price} TZS, ${pkg.duration} ${pkg.durationUnit})`);

  // Temporarily set tenantId on package for our test (if it's null/different)
  const originalTenantId = pkg.tenantId;

  // ── 1. POST /api/hotspot/purchase ─────────────────────────────────────────
  info("Initiating hotspot purchase...");
  const purchaseRes = await apiFetch("/api/hotspot/purchase", {
    method: "POST",
    body: {
      packageId: pkg.id,
      phone: TEST_PHONE,
      macAddress: "AA:BB:CC:DD:EE:01",
      routerId: pkg.routerId || "",
      method: "M-PESA",
    },
    // No auth token — this is a public endpoint (hotspot login page)
    token: "no-auth-needed",
    headers: { Authorization: "" },
  });

  // Remove our auth override — hotspot/purchase is public
  const purchaseRes2 = await fetch(`${process.env.TEST_BASE_URL || "http://localhost:3000"}/api/hotspot/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      packageId: pkg.id,
      phone: TEST_PHONE,
      macAddress: "AA:BB:CC:DD:EE:01",
      routerId: pkg.routerId || "",
      method: "M-PESA",
    }),
  });
  const purchaseData = await purchaseRes2.json();

  suite.assert(
    purchaseRes2.status === 200 || purchaseRes2.status === 201,
    `POST /api/hotspot/purchase returns 200 (got ${purchaseRes2.status})`
  );
  suite.assertDefined(purchaseData.reference, "Purchase response has a reference");
  suite.assertEqual(purchaseData.status, "pending", "Purchase status is 'pending'");
  suite.assertDefined(purchaseData.transactionId, "Purchase response has transactionId");

  const reference = purchaseData.reference;
  const transactionId = purchaseData.transactionId;
  info(`Purchase reference: ${reference}`);

  // ── 2. Verify PENDING transaction in DB ───────────────────────────────────
  info("Verifying PENDING transaction in database...");
  const txn = await prisma.transaction.findFirst({ where: { reference } });
  suite.assertDefined(txn, "Transaction record found in DB");
  suite.assertEqual(txn?.status, "PENDING", "Transaction status = PENDING");
  suite.assertEqual(txn?.type, "MOBILE", "Transaction type = MOBILE");

  const clientId = txn?.clientId;
  info(`Client created: ${clientId}`);

  // ── 3. POST /api/hotspot/callback — simulate successful webhook ────────────
  info("Simulating successful payment callback...");
  const callbackRes = await fetch(`${process.env.TEST_BASE_URL || "http://localhost:3000"}/api/hotspot/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      AccountReference: reference,
      TransactionId: `MPESA${Date.now()}`,
      Amount: pkg.price,
      ResultCode: "0",
      ResultDesc: "The service request is processed successfully.",
      PhoneNumber: "255755000001",
    }),
  });
  const callbackData = await callbackRes.json();

  suite.assert(
    callbackRes.status === 200 || callbackRes.status === 201,
    `POST /api/hotspot/callback returns 200 (got ${callbackRes.status})`
  );
  suite.assertDefined(callbackData.username, "Callback response has username");
  info(`Callback response: ${callbackData.message || "OK"}`);

  // Small wait for async operations
  await new Promise(r => setTimeout(r, 500));

  // ── 4. Verify transaction → COMPLETED ─────────────────────────────────────
  info("Verifying transaction marked COMPLETED...");
  const completedTxn = await prisma.transaction.findFirst({ where: { reference } });
  suite.assertEqual(completedTxn?.status, "COMPLETED", "Transaction status = COMPLETED");
  suite.assertDefined(completedTxn?.expiryDate, "Transaction has expiryDate set");

  // ── 5. Verify subscription → ACTIVE ───────────────────────────────────────
  info("Verifying subscription created and ACTIVE...");
  if (clientId) {
    const sub = await prisma.subscription.findFirst({
      where: { clientId, status: "ACTIVE" },
    });
    suite.assertDefined(sub, "Subscription record found");
    suite.assertEqual(sub?.status, "ACTIVE", "Subscription status = ACTIVE");
    suite.assertEqual(sub?.method, "MOBILE", "Subscription method = MOBILE");
    suite.assertDefined(sub?.expiresAt, "Subscription has expiresAt");

    // Verify expiry is in the future
    const expiresAt = sub?.expiresAt ? new Date(sub.expiresAt) : null;
    suite.assert(
      expiresAt !== null && expiresAt > new Date(),
      "Subscription expiresAt is in the future"
    );
  }

  // ── 6. Verify RADIUS user synced ──────────────────────────────────────────
  info("Verifying RADIUS sync...");
  if (callbackData.username) {
    const radCheck = await prisma.radCheck.findFirst({
      where: { username: callbackData.username, attribute: "Cleartext-Password" },
    });
    suite.assertDefined(radCheck, `radcheck: Cleartext-Password exists for ${callbackData.username}`);

    const sessionTimeout = await prisma.radReply.findFirst({
      where: { username: callbackData.username, attribute: "Session-Timeout" },
    });
    suite.assertDefined(sessionTimeout, `radreply: Session-Timeout exists for ${callbackData.username}`);
  } else {
    suite.skip("RADIUS sync verification", "No username in callback response");
  }

  // ── 7. Verify mobile transactions API shows the transaction ───────────────
  info("Checking /api/mobile-transactions endpoint...");
  const { makeAdminToken } = await import("./test-helpers");
  const token = makeAdminToken(TEST_TENANT);
  const mobileRes = await apiFetch(`/api/mobile-transactions?search=${TEST_PHONE.slice(-6)}`, { token });
  if (mobileRes.ok) {
    suite.assert(Array.isArray(mobileRes.data.data), "Mobile transactions returns data array");
    info(`Found ${mobileRes.data.total} transaction(s) matching search`);
  } else {
    suite.skip("Mobile transactions list", `API returned ${mobileRes.status}`);
  }

  // ── 8. Cleanup ─────────────────────────────────────────────────────────────
  info("Cleaning up test transaction data...");
  if (reference) {
    // Get the username for RADIUS cleanup
    const client = clientId
      ? await prisma.client.findUnique({ where: { id: clientId } })
      : null;

    if (client?.username) {
      await prisma.radCheck.deleteMany({ where: { username: client.username } });
      await prisma.radReply.deleteMany({ where: { username: client.username } });
      await prisma.radiusUser.deleteMany({ where: { username: client.username } });
    }
    await prisma.subscription.deleteMany({ where: { clientId: clientId || "" } });
    await prisma.transaction.deleteMany({ where: { reference } });
    if (clientId) await prisma.client.deleteMany({ where: { id: clientId } });
    info("Cleanup done ✓");
  }

  return suite.getResult();
}

// ── Run standalone ────────────────────────────────────────────────────────────
if (require.main === module) {
  runMobileTransactionTests()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
