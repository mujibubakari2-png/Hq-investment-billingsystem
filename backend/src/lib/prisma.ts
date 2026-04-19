import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";

console.log(`[DATABASE] Connecting to: ${connectionString.replace(/:[^:]+@/, ':***@')}`);

let pool: Pool;
let adapter: PrismaPg;

try {
    pool = new Pool({ connectionString });
    adapter = new PrismaPg(pool);
    console.log("[DATABASE] Pool and adapter created successfully");
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
