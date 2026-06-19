import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Bug #11 FIX: Lazy initialization — defer pool/client creation until the first
// actual database call. During `next build`, this module is imported but no DB
// call is made, so CI/CD environments without DATABASE_URL won't fail at build time.

let _prisma: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error(
            "DATABASE_URL environment variable is not set. " +
            "Please set it in your .env file.\n" +
            "Format: postgresql://user:password@host:port/database"
        );
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

function getPrisma(): PrismaClient {
    if (_prisma) return _prisma;

    if (globalForPrisma.prisma) {
        _prisma = globalForPrisma.prisma;
        return _prisma;
    }

    _prisma = createPrismaClient();

    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = _prisma;
    }

    return _prisma;
}

// Export as a Proxy so existing code using `prisma.xxx` still works transparently,
// while the actual client is only created on the first method call.
export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        const client = getPrisma() as any;
        const value = client[prop];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    },
});

export default prisma;
