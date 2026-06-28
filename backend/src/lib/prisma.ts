import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// DEBUG HOOK: Wrap JSON.parse to log problematic inputs during dev.
if (process.env.NODE_ENV !== 'production' && !(globalThis as any).__jsonParseWrapped) {
    (globalThis as any).__jsonParseWrapped = true;
    const _origParse = JSON.parse;
    JSON.parse = (text: any, reviver?: (key: any, value: any) => any) => {
        try {
            return _origParse.call(JSON, text, reviver as any);
        } catch (err: any) {
            try {
                const sample = typeof text === 'string' ? text.slice(0, 5000) : String(text);
                console.error('[DEBUG][JSON.parse] failed to parse input sample (truncated):', sample);
                console.error('[DEBUG][JSON.parse] thrown error stack:', err && err.stack ? err.stack : '<no stack>');
            } catch (e) {
                console.error('[DEBUG][JSON.parse] failed to stringify input');
            }
            throw err;
        }
    };
}

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

    console.log(`[DATABASE] Connecting to: ${connectionString.replace(/:[^:]+@/, ':***@')}`);

    const isProduction = process.env.NODE_ENV === "production";
    const maxConnections = isProduction ? 10 : 3;
    const idleTimeoutMillis = isProduction ? 30000 : 10000;

    const pool = new Pool({
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

    const adapter = new PrismaPg(pool);
    console.log(`[DATABASE] Connection pool created (max: ${maxConnections}, idle timeout: ${idleTimeoutMillis}ms)`);

    const client = new PrismaClient({
        adapter,
        errorFormat: 'pretty',
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
    });
    console.log("[DATABASE] Prisma client created successfully");
    return client;
}

// Use globalThis to reuse the client across hot-reloads in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
