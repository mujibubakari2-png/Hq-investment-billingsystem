import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  
  // App Config
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:5173"),
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

  // Webhooks
  PALMPESA_WEBHOOK_SECRET: z.string().optional(),
  HALOPESA_WEBHOOK_SECRET: z.string().optional(),
  TPESA_WEBHOOK_SECRET: z.string().optional(),
  MPESA_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  // Mikrotik
  MIKROTIK_USE_HTTPS: z.string().default("false").transform((v) => v === "true"),
  MIKROTIK_TIMEOUT_MS: z.string().default("8000").transform(Number),
  MIKROTIK_INSECURE: z.string().default("false").transform((v) => v === "true"),
});

// Since Next.js might bundle this for Edge/Client sometimes, we fallback gracefully
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  // We don't throw in production if it's missing just some non-critical ones, 
  // but it's good to log the error.
}

export const env = parsedEnv.success ? parsedEnv.data : (process.env as any);
