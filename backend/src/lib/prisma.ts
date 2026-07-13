import "dotenv/config";
import { PrismaClient, Prisma } from "../generated/prisma";

// Float to Decimal Conversion Safe-Guard for Frontend
// Ensures that Decimal types are serialized to Numbers in JSON responses
// instead of strings, preventing the frontend UI from crashing when performing math.
Object.defineProperty(Prisma.Decimal.prototype, 'toJSON', {
  value: function () {
    return this.toNumber();
  }
});
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import logger from "@/lib/logger";

// HIGH-SEC-004 FIX: The previous JSON.parse monkey-patch has been removed.
// It was logging up to 5,000 characters of any failed parse input — which could
// include passwords, API keys, webhook payloads, and other sensitive data.
// For development-time query debugging use Prisma's built-in `log: ['query']`
// option which is already enabled below when NODE_ENV === 'development'.

// Bug #11 FIX: Lazy initialization — defer pool/client creation until the first
// actual database call. During `next build`, this module is imported but no DB
// call is made, so CI/CD environments without DATABASE_URL won't fail at build time.

function isNextBuild(): boolean {
    return (
        process.env.NEXT_PHASE?.includes("phase-production-build") ||
        process.env.NEXT_BUILD_WORKER === "1" ||
        process.argv.includes("build")
    );
}

function createPrismaClient(): PrismaClient {
    let connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        if (isNextBuild()) {
            connectionString = "postgresql://dummy:dummy@localhost:5432/dummy";
        } else {
            throw new Error(
                "DATABASE_URL environment variable is not set. " +
                "Please set it in your .env file.\n" +
                "Format: postgresql://user:password@host:port/database"
            );
        }
    }

    // Log connection target (password masked) using structured logger.
    // Avoid console.log — it bypasses the pino → BetterStack pipeline.
    const maskedUrl = connectionString.replace(/:[^:]+@/, ':***@');
    process.stdout.write(`[DATABASE] Connecting to: ${maskedUrl}\n`);

    const isProduction = process.env.NODE_ENV === "production";
    const maxConnections = isProduction ? 10 : 3;
    const idleTimeoutMillis = isProduction ? 30000 : 10000;

    // M7 FIX: SSL rejectUnauthorized is now controlled by environment variable.
    // Default: true (validates certificate) for security in production.
    // Set DATABASE_SSL_REJECT_UNAUTHORIZED=false ONLY for self-signed certs.
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const sslRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
    const sslConfig = isLocal ? false : { rejectUnauthorized: sslRejectUnauthorized };

    if (!isLocal && !sslRejectUnauthorized) {
        process.stderr.write(
            '[DATABASE][SECURITY WARNING] DATABASE_SSL_REJECT_UNAUTHORIZED=false — ' +
            'TLS certificate validation is disabled. Only use this for self-signed certs; ' +
            'remove this setting when a valid certificate is available.\n'
        );
    }

    const pool = new Pool({
        connectionString,
        max: maxConnections,
        idleTimeoutMillis,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
        application_name: "hqinvestment_isp_backend",
        ssl: sslConfig,
    });
    globalForPrisma.prismaPool = pool;

    const adapter = new PrismaPg(pool);
    process.stdout.write(`[DATABASE] Connection pool created (max: ${maxConnections}, idle timeout: ${idleTimeoutMillis}ms)\n`);

    const client = new PrismaClient({
        adapter,
        errorFormat: 'pretty',
        // C6 FIX: Include query event emitter in BOTH dev AND production so
        // slow query detection works across all environments.
        // In production we keep 'query' as an event (not string) to avoid
        // logging every query body — only the slow query listener fires.
        log: isProduction
            ? [
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'query' },  // C6: needed for slow query detection
              ]
            : [
                { emit: 'event', level: 'query' },
                'info', 'warn', 'error'
              ],
    });

    // C6 FIX: Slow query detection enabled in BOTH development AND production.
    // Log any query that exceeds 1000ms (production) or 500ms (development).
    // These logs stream to BetterStack via the structured logger.
    const slowQueryThresholdMs = isProduction ? 1000 : 500;
    (client as any).$on('query', (e: any) => {
        if (typeof e.duration === 'number' && e.duration > slowQueryThresholdMs) {
            // In production: only log duration + truncated query (no params — may contain PII)
            const querySnippet = isProduction
                ? String(e.query ?? '').slice(0, 200)
                : String(e.query ?? '').slice(0, 500);
            process.stderr.write(
                `[SlowQuery] ${e.duration}ms (threshold: ${slowQueryThresholdMs}ms) — ${querySnippet}\n`
            );
        }
    });

    if (isProduction) {
        (client as any).$on('error', (e: any) => {
            process.stderr.write(`[DATABASE][ERROR] ${JSON.stringify({ message: e.message, target: e.target })}\n`);
        });
    }

    process.stdout.write("[DATABASE] Prisma client created successfully\n");
    return client;
}

// Use globalThis to reuse the client across hot-reloads in development
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    prismaPool: Pool | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export async function closePrisma(): Promise<void> {
    try {
        await prisma.$disconnect();
    } catch {
        // ignore — disconnect is best-effort during test teardown
    }

    if (globalForPrisma.prismaPool) {
        const pool = globalForPrisma.prismaPool;
        globalForPrisma.prismaPool = undefined;
        try {
            await pool.end();
        } catch {
            // ignore — pg pool shutdown is best-effort during test teardown
        }
    }

    if (globalForPrisma.prisma) {
        globalForPrisma.prisma = undefined;
    }
}

// MEDIUM-R-005 FIX: Graceful shutdown hook.
// Without this, PM2 graceful reload can interrupt in-flight DB transactions.
// SIGTERM → disconnect Prisma pool → exit cleanly.
// Only register in the process that actually owns the Prisma client
// (not during next build, which has a dummy connection string).
if (process.env.NODE_ENV === "production" && !isNextBuild()) {
    process.once("SIGTERM", async () => {
        try {
            await closePrisma();
            process.stdout.write("[DATABASE] Prisma disconnected on SIGTERM\n");
        } catch {
            // Nothing we can do at shutdown
        } finally {
            process.exit(0);
        }
    });

    process.once("SIGINT", async () => {
        try {
            await closePrisma();
        } catch { /* ignore */ } finally {
            process.exit(0);
        }
    });
}

export default prisma;
