/**
 * run-all-tests.ts
 *
 * Orchestrates all HQ Investment integration test suites.
 *
 * Usage:
 *   npx ts-node src/scripts/run-all-tests.ts
 *
 * Individual suites can also be run standalone:
 *   npx ts-node src/scripts/test-radius-flow.ts
 *   npx ts-node src/scripts/test-payment-channels.ts
 *   npx ts-node src/scripts/test-mobile-transaction.ts
 *   npx ts-node src/scripts/test-voucher-radius.ts
 *   npx ts-node src/scripts/test-mikrotik-refresh.ts
 */

import "dotenv/config";
import prisma from "../lib/prisma";
import { SuiteResult, printSummary, C } from "./test-helpers";

// ── Import test suites ────────────────────────────────────────────────────────
import { runRadiusTests } from "./test-radius-flow";
import { runPaymentChannelTests } from "./test-payment-channels";
import { runMobileTransactionTests } from "./test-mobile-transaction";
import { runVoucherRadiusTests } from "./test-voucher-radius";
import { runMikroTikRefreshTests } from "./test-mikrotik-refresh";

// ── Suite registry ────────────────────────────────────────────────────────────
const SUITES: Array<{ label: string; fn: () => Promise<SuiteResult> }> = [
  { label: "RADIUS Flow",                  fn: runRadiusTests },
  { label: "Payment Channels",             fn: runPaymentChannelTests },
  { label: "Mobile Transactions",          fn: runMobileTransactionTests },
  { label: "Voucher + RADIUS Integration", fn: runVoucherRadiusTests },
  { label: "MikroTik Auto-Refresh",        fn: runMikroTikRefreshTests },
];

// ── Main runner ───────────────────────────────────────────────────────────────
async function main() {
  const border = "═".repeat(56);
  console.log(`\n${C.bold}╔${border}╗`);
  console.log(`║${"  HQ Investment — Integration Test Suite".padEnd(56)}║`);
  console.log(`╚${border}╝${C.reset}`);
  console.log(`\n${C.gray}  Base URL : ${process.env.TEST_BASE_URL || "http://localhost:3000"}`);
  console.log(`  Database : ${(process.env.DATABASE_URL || "").replace(/:([^@]+)@/, ":****@")}${C.reset}\n`);

  const results: SuiteResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    console.log(`\n${C.gray}[${i + 1}/${SUITES.length}] Starting: ${suite.label}...${C.reset}`);
    const suiteStart = Date.now();

    try {
      const result = await suite.fn();
      result.name = suite.label; // Normalise name
      results.push(result);
    } catch (err: any) {
      console.error(`\n${C.red}  ⚠ Suite "${suite.label}" crashed: ${err.message}${C.reset}`);
      results.push({
        name: suite.label,
        passed: 0,
        failed: 1,
        skipped: 0,
        errors: [`Suite crashed: ${err.message}`],
      });
    }

    const elapsed = ((Date.now() - suiteStart) / 1000).toFixed(1);
    console.log(`${C.gray}  ⏱  Completed in ${elapsed}s${C.reset}`);
  }

  const totalMs = Date.now() - startTime;
  console.log(`\n${C.gray}  Total elapsed: ${(totalMs / 1000).toFixed(1)}s${C.reset}`);

  printSummary(results);

  await prisma.$disconnect();

  const anyFailed = results.some((r) => r.failed > 0);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error in test runner:", e);
  prisma.$disconnect();
  process.exit(1);
});
