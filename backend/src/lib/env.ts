import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),

  // App Config
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  APP_NAME: z.string().default("HQ INVESTMENT"),

  // JWT
  JWT_SECRET: z.string().min(32).optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),

  // SMTP Settings
  SMTP_HOST: z.string().default("smtp.ethereal.email"),
  SMTP_PORT: z.string().default("587").transform(Number),
  SMTP_SECURE: z.string().default("false").transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
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
  PALMPESA_API_URL: z.string().url().default("https://api.palmpesa.com/v1"),
  PALMPESA_API_KEY: z.string().optional(),

  // ─── ZenoPay ──────────────────────────────────────────────────────────────
  ZENOPAY_API_URL: z.string().url().default("https://zenoapi.com/api"),
  ZENOPAY_API_KEY: z.string().optional(),
  ZENOPAY_ACCOUNT_ID: z.string().optional(),

  // ─── Mongike ──────────────────────────────────────────────────────────────
  MONGIKE_API_URL: z.string().url().default("https://api.mongike.com/v1"),
  MONGIKE_API_KEY: z.string().optional(),
  MONGIKE_API_SECRET: z.string().optional(),

  // ─── HarakaPay ────────────────────────────────────────────────────────────
  HARAKAPAY_API_URL: z.string().url().default("https://api.harakapay.net/v1"),
  HARAKAPAY_API_KEY: z.string().optional(),
  HARAKAPAY_API_SECRET: z.string().optional(),

  // ─── Payment Global Settings ──────────────────────────────────────────────
  // "sandbox" or "live"
  PAYMENT_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),

  // Mikrotik
  MIKROTIK_USE_HTTPS: z.string().default("false").transform((v) => v === "true"),
  MIKROTIK_TIMEOUT_MS: z.string().default("8000").transform(Number),
  MIKROTIK_INSECURE: z.string().default("false").transform((v) => v === "true"),
});

// Since Next.js might bundle this for Edge/Client sometimes, we fallback gracefully
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
}

export const env = parsedEnv.success ? parsedEnv.data : (process.env as any);
