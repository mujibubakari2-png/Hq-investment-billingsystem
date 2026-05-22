/**
 * test-helpers.ts
 *
 * Shared utilities for the HQ Investment integration test suite.
 * Provides: JWT token generation, HTTP fetch wrapper,
 *           assertion helpers, colored output, and cleanup utilities.
 */

import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// ── Environment ───────────────────────────────────────────────────────────────

export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "kng_7f3a2b9c1d4e5f6a8b0c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a";

// ── Colors ────────────────────────────────────────────────────────────────────

export const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

export function pass(msg: string) {
  console.log(`  ${C.green}✅ PASS${C.reset}  ${msg}`);
}

export function fail(msg: string, detail?: string) {
  console.log(`  ${C.red}❌ FAIL${C.reset}  ${msg}`);
  if (detail) console.log(`         ${C.gray}${detail}${C.reset}`);
}

export function info(msg: string) {
  console.log(`  ${C.cyan}ℹ${C.reset}      ${msg}`);
}

export function warn(msg: string) {
  console.log(`  ${C.yellow}⚠️${C.reset}      ${msg}`);
}

export function header(title: string) {
  const line = "─".repeat(52);
  console.log(`\n${C.bold}${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.bold}${C.cyan}${line}${C.reset}`);
}

// ── Auth Token ────────────────────────────────────────────────────────────────

/** Generate a signed ADMIN JWT for API testing */
export function makeAdminToken(tenantId: string = "test-tenant-hq-001"): string {
  return jwt.sign(
    {
      userId: "test-admin-user-001",
      username: "testadmin",
      role: "ADMIN",
      tenantId,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

export function makeSuperAdminToken(): string {
  return jwt.sign(
    {
      userId: "test-super-admin-001",
      username: "testsuperadmin",
      role: "SUPER_ADMIN",
      tenantId: null,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// ── HTTP Helpers ──────────────────────────────────────────────────────────────

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
  raw: string;
}

export async function apiFetch<T = any>(
  path: string,
  options: {
    method?: string;
    body?: object;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, token, headers = {} } = options;
  const authToken = token || makeAdminToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let data: T;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw as any;
  }

  return { status: res.status, ok: res.ok, data, raw };
}

// ── Assertion Engine ──────────────────────────────────────────────────────────

export interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export class TestSuite {
  private result: SuiteResult;

  constructor(name: string) {
    this.result = { name, passed: 0, failed: 0, skipped: 0, errors: [] };
    header(name);
  }

  assert(condition: boolean, label: string, detail?: string): boolean {
    if (condition) {
      this.result.passed++;
      pass(label);
      return true;
    } else {
      this.result.failed++;
      const errMsg = `${label}${detail ? ` — ${detail}` : ""}`;
      this.result.errors.push(errMsg);
      fail(label, detail);
      return false;
    }
  }

  assertEqual<T>(actual: T, expected: T, label: string): boolean {
    return this.assert(
      actual === expected,
      label,
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }

  assertIncludes(value: string, substr: string, label: string): boolean {
    return this.assert(
      value?.includes(substr),
      label,
      `"${substr}" not found in "${value}"`
    );
  }

  assertDefined(value: any, label: string): boolean {
    return this.assert(value !== undefined && value !== null, label, `value is ${value}`);
  }

  skip(label: string, reason: string) {
    this.result.skipped++;
    warn(`SKIP  ${label} — ${reason}`);
  }

  getResult(): SuiteResult {
    const total = this.result.passed + this.result.failed;
    const colour = this.result.failed > 0 ? C.red : C.green;
    console.log(
      `\n  ${colour}${C.bold}Result: ${this.result.passed}/${total} passed${this.result.skipped > 0 ? `, ${this.result.skipped} skipped` : ""}${C.reset}`
    );
    return this.result;
  }
}

// ── Database Cleanup Helpers ──────────────────────────────────────────────────

/** Prefix used for all test-generated records — safe to delete after tests */
export const TEST_PREFIX = "TEST_";

export async function cleanupTestData(testTenantId: string) {
  info(`Cleaning up test data for tenant: ${testTenantId}`);
  try {
    // Delete in dependency order (children first)
    await prisma.routerLog.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.transaction.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.radCheck.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.radReply.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.radiusUser.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.voucher.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.client.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.paymentChannel.deleteMany({ where: { tenantId: testTenantId } });
    info("Test data cleaned up ✓");
  } catch (e: any) {
    warn(`Cleanup warning: ${e.message}`);
  }
}

export async function cleanupByUsername(username: string, tenantId: string | null) {
  try {
    await prisma.radCheck.deleteMany({ where: { username, tenantId } });
    await prisma.radReply.deleteMany({ where: { username, tenantId } });
    await prisma.radiusUser.deleteMany({ where: { username, tenantId } });
  } catch (_) {}
}

// ── Summary Printer ───────────────────────────────────────────────────────────

export function printSummary(results: SuiteResult[]) {
  const border = "═".repeat(56);
  console.log(`\n${C.bold}╔${border}╗`);
  console.log(`║${"  HQ Investment — Integration Test Results".padEnd(56)}║`);
  console.log(`╚${border}╝${C.reset}\n`);

  let totalPassed = 0, totalFailed = 0, totalSkipped = 0;

  results.forEach((r, i) => {
    const status = r.failed > 0
      ? `${C.red}❌ FAIL${C.reset}`
      : r.skipped > 0 && r.passed === 0
      ? `${C.yellow}⚠ SKIP${C.reset}`
      : `${C.green}✅ PASS${C.reset}`;

    const assertions = `${r.passed}✅ ${r.failed}❌ ${r.skipped}⚠`;
    console.log(`  [${i + 1}/${results.length}] ${r.name.padEnd(30)} ${status}  (${assertions})`);
    totalPassed += r.passed;
    totalFailed += r.failed;
    totalSkipped += r.skipped;
  });

  console.log(`\n${C.bold}  Total: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped${C.reset}`);

  if (totalFailed > 0) {
    console.log(`\n${C.red}${C.bold}  ⚠ Some tests failed. Review errors above.${C.reset}`);
    results.filter(r => r.errors.length > 0).forEach(r => {
      console.log(`\n  ${C.red}Failures in: ${r.name}${C.reset}`);
      r.errors.forEach(e => console.log(`    • ${e}`));
    });
  } else {
    console.log(`\n${C.green}${C.bold}  🎉 All tests passed!${C.reset}`);
  }
}
