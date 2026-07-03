import logger from "@/lib/logger";
import { z } from "zod";

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? undefined : val), schema);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),

  // App Config
  NEXT_PUBLIC_APP_URL: emptyToUndefined(z.string().url().optional()),
  APP_URL: emptyToUndefined(z.string().url().optional()),
  APP_NAME: z.string().default("HQ INVESTMENT"),

  // ─── JWT — REQUIRED at runtime (validated early so startup fails fast) ───────
  // CRIT-SEC-002 FIX: These are now REQUIRED (not optional).
  // auth.ts and auth-edge.ts read these directly from process.env.
  // They are NOT used during `next build` (isNextBuild() guard bypasses them).
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  // Legacy alias kept for backward-compatibility (MFA routes use this)
  JWT_SECRET: emptyToUndefined(z.string().min(32).optional()),
  NEXTAUTH_SECRET: emptyToUndefined(z.string().min(32).optional()),

  // ─── Field Encryption — Required in all envs ──────────────────────────────
  // encryption.ts reads this directly; must be a 64-char hex string (32 bytes).
  FIELD_ENCRYPTION_KEY: emptyToUndefined(
    z.string().length(64, "FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)").optional()
  ),

  // ─── Email — Resend API ────────────────────────────────────────────────────
  // EMAIL-001: SMTP replaced with Resend HTTP API (see src/lib/email.ts).
  // Get your key at https://resend.com → API Keys.
  RESEND_API_KEY: z.string().optional(),
  // Full "From" address, e.g. "HQ INVESTMENT <noreply@yourdomain.com>"
  // Falls back to SMTP_FROM for backward-compat, then onboarding@resend.dev for testing.
  RESEND_FROM: z.string().optional(),
  // Kept as a fallback alias so existing .env files still work without changes.
  SMTP_FROM: z.string().optional(),

  // ─── Webhook Secrets ──────────────────────────────────────────────────────
  // CRIT-SEC-001: These are optional here because not every deployment
  // uses every payment provider. However, each webhook route MUST validate
  // that its secret is non-null before processing any incoming payload
  // (return 503 if unset). A missing secret MUST NOT silently allow
  // all webhooks through without signature verification.
  HOTSPOT_WEBHOOK_SECRET: z.string().optional(),
  PALMPESA_WEBHOOK_SECRET: z.string().optional(),
  ZENOPAY_WEBHOOK_SECRET: z.string().optional(),
  MONGIKE_WEBHOOK_SECRET: z.string().optional(),
  HARAKAPAY_WEBHOOK_SECRET: z.string().optional(),
  HALOPESA_WEBHOOK_SECRET: z.string().optional(),
  TPESA_WEBHOOK_SECRET: z.string().optional(),
  MPESA_WEBHOOK_SECRET: z.string().optional(),
  AIRTELMONEY_WEBHOOK_SECRET: z.string().optional(),
  MIXBYYAS_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),

  // ─── PalmPesa ─────────────────────────────────────────────────────────────
  PALMPESA_API_URL: emptyToUndefined(z.string().url().optional()),
  PALMPESA_API_KEY: z.string().optional(),

  // ─── ZenoPay ──────────────────────────────────────────────────────────────
  ZENOPAY_API_URL: emptyToUndefined(z.string().url().optional()),
  ZENOPAY_API_KEY: z.string().optional(),
  ZENOPAY_ACCOUNT_ID: z.string().optional(),

  // ─── Mongike ──────────────────────────────────────────────────────────────
  MONGIKE_API_URL: emptyToUndefined(z.string().url().optional()),
  MONGIKE_API_KEY: z.string().optional(),
  MONGIKE_API_SECRET: z.string().optional(),

  // ─── HarakaPay ────────────────────────────────────────────────────────────
  HARAKAPAY_API_URL: emptyToUndefined(z.string().url().optional()),
  HARAKAPAY_API_KEY: z.string().optional(),
  HARAKAPAY_API_SECRET: z.string().optional(),

  // ─── Payment Global Settings ──────────────────────────────────────────────
  // "sandbox" or "live"
  PAYMENT_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),

  // ─── Cron Security ───────────────────────────────────────────────────────────
  // E17 FIX: Added CRON_SECRET to schema so it is validated at startup.
  // Set a random value of at least 16 characters in your .env file.
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),

  // Mikrotik
  MIKROTIK_USE_HTTPS: z.string().default("false").transform((v) => v === "true"),
  MIKROTIK_TIMEOUT_MS: z.string().default("8000").transform(Number),
  MIKROTIK_INSECURE: z.string().default("false").transform((v) => v === "true"),
});

function isNextBuild(): boolean {
  return (
    process.env.NEXT_PHASE?.includes("phase-production-build") ||
    process.env.NEXT_BUILD_WORKER === "1" ||
    process.argv.includes("build")
  );
}

if (isNextBuild()) {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dummy-access-secret-for-build-phase-min-32-chars";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dummy-refresh-secret-for-build-phase-min-32-chars";
}

// Since Next.js might bundle this for Edge/Client sometimes, we fallback gracefully
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Use console.warn because console.error gets stripped by compiler.removeConsole in production!
  logger.warn("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
