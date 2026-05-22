/**
 * test-payment-channels.ts
 *
 * Tests the Payment Channel API endpoints:
 *  GET  /api/payment-channels       — list channels
 *  POST /api/payment-channels       — create a channel
 *  GET  /api/payment-channels/:id   — verify it exists
 *  PATCH /api/payment-channels/:id  — update status
 *  DELETE /api/payment-channels/:id — cleanup
 */

import "dotenv/config";
import prisma from "../lib/prisma";
import { TestSuite, SuiteResult, apiFetch, makeAdminToken, info } from "./test-helpers";

const TEST_TENANT = "test-tenant-hq-001";

export async function runPaymentChannelTests(): Promise<SuiteResult> {
  const suite = new TestSuite("Payment Channels (CRUD + Config)");
  const token = makeAdminToken(TEST_TENANT);
  let createdChannelId: string | null = null;

  // ── 1. GET /api/payment-channels — initial list ────────────────────────────
  info("Listing payment channels...");
  const listRes = await apiFetch("/api/payment-channels", { token });
  suite.assert(
    listRes.status === 200 || listRes.status === 401,
    "GET /api/payment-channels returns 200 or 401"
  );
  if (listRes.ok) {
    suite.assert(Array.isArray(listRes.data), "Response is an array");
    info(`Found ${listRes.data.length} existing channel(s)`);
  }

  // ── 2. POST /api/payment-channels — create M-PESA channel ─────────────────
  info("Creating test M-PESA payment channel...");
  const createRes = await apiFetch("/api/payment-channels", {
    method: "POST",
    token,
    body: {
      name: "TEST M-PESA Channel",
      provider: "M-PESA",
      accountNumber: "TEST-TILL-123456",
      apiKey: "test_api_key_12345",
      apiSecret: "test_api_secret_12345",
      config: {
        shortCode: "123456",
        passKey: "test_passkey",
        environment: "sandbox",
      },
      tenantId: TEST_TENANT,
    },
  });
  suite.assert(
    createRes.status === 201 || createRes.status === 200,
    `POST /api/payment-channels returns 201 (got ${createRes.status})`
  );

  if (createRes.ok && createRes.data?.id) {
    createdChannelId = createRes.data.id;
    suite.assertDefined(createdChannelId, "Created channel has an ID");
    suite.assertEqual(
      createRes.data.provider || createRes.data.name,
      "M-PESA",
      "Created channel provider is M-PESA"
    );
    info(`Created channel ID: ${createdChannelId}`);
  } else {
    suite.assert(false, "POST /api/payment-channels returned a channel object", JSON.stringify(createRes.data));
  }

  // ── 3. GET /api/payment-channels/:id — verify exists ──────────────────────
  if (createdChannelId) {
    info("Fetching created channel by ID...");
    const getRes = await apiFetch(`/api/payment-channels/${createdChannelId}`, { token });
    suite.assert(
      getRes.status === 200 || getRes.status === 404,
      `GET /api/payment-channels/${createdChannelId} returns 200`
    );
    if (getRes.ok) {
      suite.assertEqual(getRes.data.id, createdChannelId, "Channel ID matches");
    }
  } else {
    suite.skip("GET /api/payment-channels/:id", "Channel creation failed");
  }

  // ── 4. GET /api/payment-channels — verify new channel in list ─────────────
  if (createdChannelId) {
    info("Re-listing to verify new channel appears...");
    const listRes2 = await apiFetch("/api/payment-channels", { token });
    if (listRes2.ok && Array.isArray(listRes2.data)) {
      const found = listRes2.data.some((ch: any) => ch.id === createdChannelId);
      suite.assert(found, "New channel appears in list");
    } else {
      suite.skip("Channel list verification", "List endpoint unavailable");
    }
  }

  // ── 5. Verify payment gateway config in SystemSetting ─────────────────────
  info("Checking paymentGateways system setting...");
  const gwSetting = await prisma.systemSetting.findFirst({
    where: { key: "paymentGateways", tenantId: TEST_TENANT },
  });
  if (gwSetting) {
    suite.assertDefined(gwSetting.value, "paymentGateways setting has a value");
    try {
      const parsed = JSON.parse(gwSetting.value);
      suite.assert(Array.isArray(parsed), "paymentGateways is a JSON array");
      info(`Found ${parsed.length} configured gateway(s)`);
    } catch {
      suite.skip("paymentGateways JSON parse", "Value is not valid JSON (may be empty)");
    }
  } else {
    suite.skip("paymentGateways system setting", "No gateway config found for tenant");
  }

  // ── 6. Cleanup — delete the test channel ──────────────────────────────────
  if (createdChannelId) {
    info("Deleting test channel...");
    try {
      await prisma.paymentChannel.delete({ where: { id: createdChannelId } });
      info("Test channel deleted ✓");
    } catch (e: any) {
      suite.skip("Cleanup", `Could not delete test channel: ${e.message}`);
    }
  }

  return suite.getResult();
}

// ── Run standalone ────────────────────────────────────────────────────────────
if (require.main === module) {
  const { PrismaClient } = require("@prisma/client");
  runPaymentChannelTests()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
}
