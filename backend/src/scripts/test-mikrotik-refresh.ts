/**
 * test-mikrotik-refresh.ts
 *
 * Tests the MikroTik RouterOS API integration and auto-refresh logic:
 *  1. Find a router in DB
 *  2. testConnection() → verify router info + DB status updated
 *  3. activateService() → create/enable a hotspot user
 *  4. findHotspotUserByName() → verify user exists on router
 *  5. updateHotspotUser() → change profile (simulates auto-refresh after renewal)
 *  6. suspendService() → disable + disconnect user
 *  7. findHotspotUserByName() → verify user is disabled
 *  8. activateService() again → re-enable (auto-refresh path)
 *  9. Cleanup — delete test user from MikroTik + DB logs
 *
 * NOTE: All MikroTik tests are auto-skipped if no router is reachable.
 *       They do NOT fail the build when the router is offline.
 */

import "dotenv/config";
import prisma from "../lib/prisma";
import { getMikroTikService } from "../lib/mikrotik";
import { TestSuite, SuiteResult, info, warn } from "./test-helpers";

const TEST_MT_USERNAME = "TEST-hotspot-refresh-001";
const TEST_MT_PASSWORD = "TestPass2024!";
const TEST_MT_PROFILE = "default";

export async function runMikroTikRefreshTests(): Promise<SuiteResult> {
  const suite = new TestSuite("MikroTik Auto-Refresh (RouterOS REST API)");

  // ── Find a router to test against ─────────────────────────────────────────
  info("Searching for a testable router in database...");
  const router = await prisma.router.findFirst({
    where: {
      status: { in: ["ONLINE", "OFFLINE"] },
    },
    orderBy: { lastSeen: "desc" },
  });

  if (!router) {
    suite.skip("All MikroTik tests", "No routers found in database");
    return suite.getResult();
  }

  info(`Found router: "${router.name}" (${router.host}:${router.apiPort || router.port})`);

  // ── Get MikroTik service ───────────────────────────────────────────────────
  let mikrotik: Awaited<ReturnType<typeof getMikroTikService>>;
  try {
    mikrotik = await getMikroTikService(router.id);
  } catch (e: any) {
    suite.skip("All MikroTik tests", `Could not create MikroTik service: ${e.message}`);
    return suite.getResult();
  }

  // ── 1. Test connection ─────────────────────────────────────────────────────
  info("Testing router connection...");
  const connResult = await mikrotik.testConnection();

  if (!connResult.success) {
    warn(`Router ${router.host} is offline: ${connResult.message}`);
    suite.skip("All MikroTik tests", `Router unreachable — ${connResult.message}`);
    return suite.getResult();
  }

  suite.assert(connResult.success, `Router ${router.host} is reachable`);
  suite.assertDefined(connResult.info, "Connection returns system info");

  if (connResult.info) {
    info(`  RouterOS ${connResult.info.version} | CPU: ${connResult.info.cpuLoad}% | Uptime: ${connResult.info.uptime}`);
    suite.assert(connResult.info.version !== "Unknown", "RouterOS version detected");
    suite.assert(connResult.info.uptime !== "0s", "Router uptime is non-zero");
  }

  // Verify DB updated
  const updatedRouter = await prisma.router.findUnique({ where: { id: router.id } });
  suite.assertEqual(updatedRouter?.status, "ONLINE", "Router status updated to ONLINE in DB");

  // ── 2. activateService() — create hotspot user ────────────────────────────
  info(`Creating test hotspot user "${TEST_MT_USERNAME}" on router...`);
  // Clean up first if leftover from previous test
  const existingUser = await mikrotik.findHotspotUserByName(TEST_MT_USERNAME);
  if (existingUser?.id) {
    await mikrotik.deleteHotspotUser(existingUser.id, TEST_MT_USERNAME);
    info("Removed leftover test user from previous run");
  }

  try {
    await mikrotik.activateService(
      TEST_MT_USERNAME,
      TEST_MT_PASSWORD,
      TEST_MT_PROFILE,
      "hotspot",
      new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h expiry
    );
    suite.assert(true, `activateService() created hotspot user "${TEST_MT_USERNAME}"`);
  } catch (e: any) {
    suite.assert(false, "activateService() did not throw", e.message);
  }

  // ── 3. findHotspotUserByName() — verify exists ────────────────────────────
  info(`Verifying "${TEST_MT_USERNAME}" exists on router...`);
  await new Promise((r) => setTimeout(r, 300)); // brief wait for RouterOS to commit
  const createdUser = await mikrotik.findHotspotUserByName(TEST_MT_USERNAME);
  suite.assertDefined(createdUser, `Hotspot user "${TEST_MT_USERNAME}" found on router`);
  suite.assert(createdUser?.disabled === false, "User is enabled (disabled = false)");

  // ── 4. updateHotspotUser() — simulate auto-refresh after plan renewal ──────
  info("Simulating auto-refresh: updating profile after plan renewal...");
  if (createdUser?.id) {
    try {
      await mikrotik.updateHotspotUser(createdUser.id, {
        profile: TEST_MT_PROFILE,
        name: TEST_MT_USERNAME,
      });
      suite.assert(true, "updateHotspotUser() succeeded (profile refresh)");
    } catch (e: any) {
      suite.assert(false, "updateHotspotUser() did not throw", e.message);
    }
  } else {
    suite.skip("updateHotspotUser()", "User not found — cannot update");
  }

  // ── 5. listAllActiveSessions() — check session count ──────────────────────
  info("Listing all active sessions on router...");
  try {
    const sessions = await mikrotik.listAllActiveSessions();
    suite.assert(typeof sessions.length === "number", `listAllActiveSessions() returned ${sessions.length} session(s)`);
    info(`  Active sessions: ${sessions.length} (PPPoE + Hotspot)`);
  } catch (e: any) {
    suite.skip("listAllActiveSessions()", `API error: ${e.message}`);
  }

  // ── 6. suspendService() — disable + disconnect user ───────────────────────
  info(`Suspending test user "${TEST_MT_USERNAME}"...`);
  try {
    await mikrotik.suspendService(TEST_MT_USERNAME, "hotspot");
    suite.assert(true, `suspendService() called for "${TEST_MT_USERNAME}"`);
  } catch (e: any) {
    suite.assert(false, "suspendService() did not throw", e.message);
  }

  // ── 7. Verify user is now disabled ────────────────────────────────────────
  info("Verifying user is disabled on router...");
  await new Promise((r) => setTimeout(r, 300));
  const suspendedUser = await mikrotik.findHotspotUserByName(TEST_MT_USERNAME);
  suite.assert(
    suspendedUser?.disabled === true,
    `Hotspot user "${TEST_MT_USERNAME}" is disabled after suspendService()`
  );

  // ── 8. Re-activate — auto-refresh path ────────────────────────────────────
  info(`Re-activating "${TEST_MT_USERNAME}" (auto-refresh after payment)...`);
  try {
    await mikrotik.activateService(
      TEST_MT_USERNAME,
      TEST_MT_PASSWORD,
      TEST_MT_PROFILE,
      "hotspot",
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    );
    suite.assert(true, `activateService() re-enabled user (auto-refresh after payment)`);
  } catch (e: any) {
    suite.assert(false, "Re-activation did not throw", e.message);
  }

  await new Promise((r) => setTimeout(r, 300));
  const reactivatedUser = await mikrotik.findHotspotUserByName(TEST_MT_USERNAME);
  suite.assert(
    reactivatedUser?.disabled === false,
    "User is re-enabled after re-activation"
  );

  // ── 9. listHotspotProfiles() — verify profiles accessible ─────────────────
  info("Listing hotspot bandwidth profiles...");
  try {
    const profiles = await mikrotik.listHotspotProfiles();
    suite.assert(Array.isArray(profiles) && profiles.length > 0, `${profiles.length} hotspot profile(s) found on router`);
    info(`  Profiles: ${profiles.map(p => p.name).join(", ")}`);
  } catch (e: any) {
    suite.skip("listHotspotProfiles()", `Error: ${e.message}`);
  }

  // ── 10. Cleanup — remove test user from router ────────────────────────────
  info(`Removing test user "${TEST_MT_USERNAME}" from router...`);
  try {
    const userToDelete = await mikrotik.findHotspotUserByName(TEST_MT_USERNAME);
    if (userToDelete?.id) {
      await mikrotik.deleteHotspotUser(userToDelete.id, TEST_MT_USERNAME);
      info(`Test user "${TEST_MT_USERNAME}" deleted from router ✓`);
    }
  } catch (e: any) {
    warn(`Could not delete test user from router: ${e.message}`);
  }

  // Clean up router logs from this test
  await prisma.routerLog.deleteMany({
    where: {
      routerId: router.id,
      username: TEST_MT_USERNAME,
    },
  });
  info("Router logs for test user cleaned up ✓");

  return suite.getResult();
}

// ── Run standalone ────────────────────────────────────────────────────────────
if (require.main === module) {
  runMikroTikRefreshTests()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
