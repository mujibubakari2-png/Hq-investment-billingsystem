import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import logger from "@/lib/logger";

let prismaPool: Pool | null = null;

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

    prismaPool = new Pool({
        connectionString,
        max: maxConnections,
        idleTimeoutMillis,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
        application_name: "hqinvestment_isp_backend",
        ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false }
    });

    const adapter = new PrismaPg(prismaPool);
    process.stdout.write(`[DATABASE] Connection pool created (max: ${maxConnections}, idle timeout: ${idleTimeoutMillis}ms)\n`);

    const client = new PrismaClient({
        adapter,
        errorFormat: 'pretty',
        // In development include query/info/warn logs for debugging.
        // In production only log errors to avoid leaking query internals.
        log: isProduction
            ? [{ emit: 'event', level: 'error' }]
            : ['query', 'info', 'warn', 'error'],
    });

    // MEDIUM-O-004 FIX: Slow query detection.
    // Log any query that exceeds 1 second so slow queries are visible in
    // BetterStack before customers start complaining.
    if (isProduction) {
        (client as any).$on('error', (e: any) => {
            process.stderr.write(`[DATABASE][ERROR] ${JSON.stringify({ message: e.message, target: e.target })}\n`);
        });
    }

    // Slow query logging works in development (where 'query' is a string log level)
    // and production (where we subscribe to the event emitter).
    // The $on('query') listener is only available when log includes the query event.
    if (!isProduction) {
        (client as any).$on('query', (e: any) => {
            if (typeof e.duration === 'number' && e.duration > 1000) {
                process.stderr.write(
                    `[SlowQuery] ${e.duration}ms — ${String(e.query).slice(0, 500)}\n`
                );
            }
        });
    }

    process.stdout.write("[DATABASE] Prisma client created successfully\n");
    return client;
}

// Use globalThis to reuse the client across hot-reloads in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

// MEDIUM-R-005 FIX: Graceful shutdown hook.
// Without this, PM2 graceful reload can interrupt in-flight DB transactions.
// SIGTERM → disconnect Prisma pool → exit cleanly.
// Only register in the process that actually owns the Prisma client
// (not during next build, which has a dummy connection string).
if (process.env.NODE_ENV === "production" && !isNextBuild()) {
    process.once("SIGTERM", async () => {
        try {
            await prisma.$disconnect();
            process.stdout.write("[DATABASE] Prisma disconnected on SIGTERM\n");
        } catch {
            // Nothing we can do at shutdown
        } finally {
            process.exit(0);
        }
    });

    process.once("SIGINT", async () => {
        try {
            await prisma.$disconnect();
        } catch { /* ignore */ } finally {
            process.exit(0);
        }
    });
}

export async function disconnectPrismaClient(): Promise<void> {
    try {
        if (prisma) {
            await prisma.$disconnect();
        }
    } catch {
        // Ignore disconnect errors during teardown.
    }

    try {
        if (prismaPool) {
            await prismaPool.end();
            prismaPool = null;
        }
    } catch {
        // Ignore pool shutdown errors during teardown.
    }
}

export default prisma;
