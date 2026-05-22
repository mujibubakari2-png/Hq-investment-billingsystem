/**
 * test-radius-flow.ts
 *
 * Tests the RADIUS synchronization library directly (no HTTP):
 *  1. syncRadiusUser  — creates radcheck + radreply rows
 *  2. suspendRadiusUser — sets Expiration to the past
 *  3. deleteRadiusUser  — removes all RADIUS rows
 */

import "dotenv/config";
import prisma from "../lib/prisma";
import { syncRadiusUser, suspendRadiusUser, deleteRadiusUser } from "../lib/radius";
import { TestSuite, SuiteResult, info, cleanupByUsername } from "./test-helpers";

const TEST_USERNAME = "TEST_radius_user_001";
const TEST_TENANT = "test-tenant-hq-001";
const TEST_PASSWORD = "TestPass@2024";
const TEST_RATE_LIMIT = "5M/10M";
const TEST_PROFILE = "TEST-5M-Package";

export async function runRadiusTests(): Promise<SuiteResult> {
  const suite = new TestSuite("RADIUS Flow (sync / suspend / delete)");

  // Cleanup any prior runs
  await cleanupByUsername(TEST_USERNAME, TEST_TENANT);

  // ── 1. syncRadiusUser — create ─────────────────────────────────────────────
  info("Syncing RADIUS user (create)...");
  const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 days

  try {
    await syncRadiusUser({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      tenantId: TEST_TENANT,
      fullName: "Test RADIUS User",
      expiresAt: futureExpiry,
      status: "Active",
      rateLimit: TEST_RATE_LIMIT,
      profileName: TEST_PROFILE,
      simultaneousUse: 1,
    });

    // Verify RadiusUser record
    const radiusUser = await prisma.radiusUser.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT },
    });
    suite.assertDefined(radiusUser, "RadiusUser record created");
    suite.assertEqual(radiusUser?.status, "Active", "RadiusUser status = Active");

    // Verify radcheck — Cleartext-Password
    const pwRow = await prisma.radCheck.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Cleartext-Password" },
    });
    suite.assertDefined(pwRow, "radcheck: Cleartext-Password exists");
    suite.assertEqual(pwRow?.value, TEST_PASSWORD, "radcheck: Cleartext-Password value correct");

    // Verify radcheck — Simultaneous-Use
    const simRow = await prisma.radCheck.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Simultaneous-Use" },
    });
    suite.assertDefined(simRow, "radcheck: Simultaneous-Use exists");
    suite.assertEqual(simRow?.value, "1", "radcheck: Simultaneous-Use = 1");

    // Verify radcheck — Expiration (must be in the future)
    const expRow = await prisma.radCheck.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Expiration" },
    });
    suite.assertDefined(expRow, "radcheck: Expiration exists");
    const expYear = futureExpiry.getFullYear().toString();
    suite.assertIncludes(expRow?.value || "", expYear, `radcheck: Expiration contains year ${expYear}`);

    // Verify radreply — Session-Timeout
    const stRow = await prisma.radReply.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Session-Timeout" },
    });
    suite.assertDefined(stRow, "radreply: Session-Timeout exists");
    const stVal = parseInt(stRow?.value || "0");
    suite.assert(stVal > 0 && stVal <= 7 * 24 * 3600, "radreply: Session-Timeout in valid range");

    // Verify radreply — Mikrotik-Rate-Limit
    const rlRow = await prisma.radReply.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Mikrotik-Rate-Limit" },
    });
    suite.assertDefined(rlRow, "radreply: Mikrotik-Rate-Limit exists");
    suite.assertEqual(rlRow?.value, TEST_RATE_LIMIT, `radreply: Rate-Limit = ${TEST_RATE_LIMIT}`);

    // Verify radreply — Mikrotik-Group
    const mgRow = await prisma.radReply.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Mikrotik-Group" },
    });
    suite.assertDefined(mgRow, "radreply: Mikrotik-Group exists");
    suite.assertEqual(mgRow?.value, TEST_PROFILE, `radreply: Mikrotik-Group = ${TEST_PROFILE}`);

  } catch (e: any) {
    suite.assert(false, "syncRadiusUser did not throw", e.message);
  }

  // ── 2. syncRadiusUser — update (no password change) ───────────────────────
  info("Re-syncing RADIUS user (update, no password change)...");
  try {
    const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
    await syncRadiusUser({
      username: TEST_USERNAME,
      tenantId: TEST_TENANT,
      expiresAt: newExpiry,
      status: "Active",
    });

    const expRow2 = await prisma.radCheck.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Expiration" },
    });
    suite.assertIncludes(
      expRow2?.value || "",
      newExpiry.getFullYear().toString(),
      "radcheck: Expiration updated to +30 days"
    );
  } catch (e: any) {
    suite.assert(false, "syncRadiusUser (update) did not throw", e.message);
  }

  // ── 3. suspendRadiusUser ───────────────────────────────────────────────────
  info("Suspending RADIUS user...");
  try {
    await suspendRadiusUser(TEST_USERNAME, TEST_TENANT);

    const radiusUser = await prisma.radiusUser.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT },
    });
    suite.assertEqual(radiusUser?.status, "Inactive", "RadiusUser.status = Inactive after suspend");

    // Expiration must be in the past
    const expRow = await prisma.radCheck.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Expiration" },
    });
    suite.assertDefined(expRow, "radcheck: Expiration still exists after suspend");
    // A past date will contain a year <= current year. A rough check:
    const expYear = parseInt(expRow?.value?.split(" ")[2] || "9999");
    suite.assert(expYear <= new Date().getFullYear(), "radcheck: Expiration year is not in the future");

    // Session-Timeout must be removed
    const stRow = await prisma.radReply.findFirst({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT, attribute: "Session-Timeout" },
    });
    suite.assert(stRow === null, "radreply: Session-Timeout removed after suspend");
  } catch (e: any) {
    suite.assert(false, "suspendRadiusUser did not throw", e.message);
  }

  // ── 4. deleteRadiusUser ────────────────────────────────────────────────────
  info("Deleting RADIUS user...");
  try {
    await deleteRadiusUser(TEST_USERNAME, TEST_TENANT);

    const radCheckCount = await prisma.radCheck.count({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT },
    });
    const radReplyCount = await prisma.radReply.count({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT },
    });
    const radiusUserCount = await prisma.radiusUser.count({
      where: { username: TEST_USERNAME, tenantId: TEST_TENANT },
    });

    suite.assertEqual(radCheckCount, 0, "radcheck: all rows deleted");
    suite.assertEqual(radReplyCount, 0, "radreply: all rows deleted");
    suite.assertEqual(radiusUserCount, 0, "radiusUser: record deleted");
  } catch (e: any) {
    suite.assert(false, "deleteRadiusUser did not throw", e.message);
  }

  return suite.getResult();
}

// ── Run standalone ────────────────────────────────────────────────────────────
if (require.main === module) {
  runRadiusTests()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
