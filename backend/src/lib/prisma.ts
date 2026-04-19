import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error(
        "DATABASE_URL environment variable is not set. " +
        "Please set it in your Railway dashboard or .env file.\n" +
        "Format: postgresql://user:password@host:port/database"
    );
}

console.log(`[DATABASE] Connecting to: ${connectionString.replace(/:[^:]+@/, ':***@')}`);

let pool: Pool;
let adapter: PrismaPg;

try {
    const isProduction = process.env.NODE_ENV === "production";
    
    // Production: Adjust pool size for Railway (smaller to conserve resources)
    // Development: Use smaller pool
    const maxConnections = isProduction ? 5 : 5;
    const idleTimeoutMillis = isProduction ? 30000 : 10000;
    
    pool = new Pool({
        connectionString,
        max: maxConnections,
        idleTimeoutMillis,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
        application_name: "kenge_isp_backend"
    });
    
    adapter = new PrismaPg(pool);
    console.log(`[DATABASE] Connection pool created (max: ${maxConnections}, idle timeout: ${idleTimeoutMillis}ms)`);
} catch (error) {
    console.error("[DATABASE] Failed to create pool/adapter:", error);
    throw error;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

try {
    globalForPrisma.prisma = globalForPrisma.prisma || new PrismaClient({
        adapter,
        errorFormat: 'pretty',
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
    });
    console.log("[DATABASE] Prisma client created successfully");
} catch (error) {
    console.error("[DATABASE] Failed to create Prisma client:", error);
    throw error;
}

export const prisma = globalForPrisma.prisma;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
