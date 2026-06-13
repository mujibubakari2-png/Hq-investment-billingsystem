import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("   Please set DATABASE_URL in your .env file");
    console.error("   Format: postgresql://user:password@host:port/database");
    process.exit(1);
}

console.log(`[SEED] Database URL: ${connectionString.replace(/:[^:]+@/, ':***@')}`);
console.log(`[SEED] Environment: ${process.env.NODE_ENV || 'development'}`);

const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
    application_name: "hqinvestment_isp_seed",
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("\n🌱 Starting database seed...\n");

    try {
        // Test connection with timeout
        console.log("[SEED] Testing database connection...");
        const startTime = Date.now();
        await Promise.race([
            prisma.$queryRaw`SELECT 1 as test`,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Connection timeout")), 10000)
            )
        ]);
        const connectionTime = Date.now() - startTime;
        console.log(`✅ Database connection successful (${connectionTime}ms)\n`);

        // 1. Seed SaaS Plans
        console.log("📋 Seeding SaaS Plans...");
        const existingPlans = await prisma.saasPlan.count();
        if (existingPlans === 0) {
            await prisma.saasPlan.createMany({
                data: [
                    { id: "free_trial",      name: "10-Day Free Trial", price: 0,     pppoeLimit: 10, hotspotLimit: null, maxRouters: 1 },
                    { id: "plan_starter",    name: "Starter",           price: 15000, pppoeLimit: 150, hotspotLimit: null, maxRouters: 3 },
                    { id: "plan_business",   name: "Business",          price: 30000, pppoeLimit: 300, hotspotLimit: null, maxRouters: 5 },
                    { id: "plan_enterprise", name: "Enterprise",        price: 50000, pppoeLimit: 5000, hotspotLimit: null, maxRouters: 10 },
                ],
                skipDuplicates: true
            });
            console.log("✅ SaaS Plans created.\n");
        } else {
            console.log(`⏭️  ${existingPlans} SaaS Plans already exist. Skipping.\n`);
        }

        console.log("🎉 Database seed completed successfully!\n");

    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        console.error("   This might be due to:");
        console.error("   - DATABASE_URL not set correctly");
        console.error("   - Database not accessible");
        console.error("   - Migrations not run yet");
        console.error("   - Network connectivity issues");
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
