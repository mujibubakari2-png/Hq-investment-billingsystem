import dotenv from 'dotenv';
dotenv.config();

// @ts-ignore
// ── Test environment bootstrap ────────────────────────────────────────────────
// All fallback values are purely fictional placeholders — never real credentials.
// Set TEST_DATABASE_URL / DATABASE_URL in your local .env or CI secrets to
// point at a real test database. See backend/.env.example for reference.
process.env.NODE_ENV = 'test';

// Database — use TEST_DATABASE_URL first, then DATABASE_URL, then localhost placeholder
const rawUrl = process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://test_user:test_password_placeholder@127.0.0.1:5432/testdb';

// Force the database name to 'testdb' to match what setup-test-db.js uses for `db push`
process.env.DATABASE_URL = rawUrl.replace(/\/[^/?]+(\?.*)?$/, '/testdb$1');

// JWT — test-only keys (never share with production)
process.env.JWT_SECRET         ||= 'ci_test_jwt_secret_must_be_32_chars_long!!';
process.env.JWT_ACCESS_SECRET  ||= 'ci_test_access_secret_must_be_at_least_32_chars_long!!!';
process.env.JWT_REFRESH_SECRET ||= 'ci_test_refresh_secret_must_be_at_least_48_chars_different_from_access!!!';

// Encryption — 64-char hex, test-only; all-zeros intentionally obvious as fake
process.env.FIELD_ENCRYPTION_KEY ||= 'cafecafecafecafecafecafecafecafecafecafecafecafecafecafecafecafe';

// Cron — test-only secret
process.env.CRON_SECRET ||= 'ci_test_cron_secret_32chars_ok!!';

// Auto-Push VPN wait — set to 0 in tests so the polling loop exits immediately.
// In production, pushConfigExecutor defaults these to 30000ms / 5000ms.
// Tests mock the MikroTik API and have no real WireGuard tunnel, so waiting
// 30s per test would make the suite take 5+ minutes for no reason.
process.env.PUSH_VPN_WAIT_MS ||= '0';
process.env.PUSH_VPN_POLL_MS ||= '0';

// Fix Float -> Decimal mock issues across 69 failing tests:
// API routes expect Prisma.Decimal (.toNumber()), but tests mock primitive numbers.
// This allows primitive numbers in mocks to seamlessly satisfy .toNumber() calls.
// @ts-ignore
Number.prototype.toNumber = function() { return this.valueOf(); };
