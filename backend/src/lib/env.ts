import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),

  // App Config
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  APP_NAME: z.string().default("HQ INVESTMENT"),

  // JWT
  JWT_SECRET: z.string().min(32).optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),

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
  PALMPESA_API_URL: z.string().url().optional(),
  PALMPESA_API_KEY: z.string().optional(),

  // ─── ZenoPay ──────────────────────────────────────────────────────────────
  ZENOPAY_API_URL: z.string().url().optional(),
  ZENOPAY_API_KEY: z.string().optional(),
  ZENOPAY_ACCOUNT_ID: z.string().optional(),

  // ─── Mongike ──────────────────────────────────────────────────────────────
  MONGIKE_API_URL: z.string().url().optional(),
  MONGIKE_API_KEY: z.string().optional(),
  MONGIKE_API_SECRET: z.string().optional(),

  // ─── HarakaPay ────────────────────────────────────────────────────────────
  HARAKAPAY_API_URL: z.string().url().optional(),
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

// Since Next.js might bundle this for Edge/Client sometimes, we fallback gracefully
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
