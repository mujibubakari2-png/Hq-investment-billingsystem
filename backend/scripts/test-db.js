import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("   Please set DATABASE_URL in your Railway dashboard");
    console.error("   Format: postgresql://user:password@host:port/database");
    process.exit(1);
}

console.log(`[DB-TEST] Testing database connection...`);
console.log(`[DB-TEST] Database URL: ${connectionString.replace(/:[^:]+@/, ':***@')}`);
console.log(`[DB-TEST] Environment: ${process.env.NODE_ENV || 'development'}`);

async function testConnection() {
    let pool: Pool;
    let prisma: PrismaClient | undefined;
    let adapter: PrismaPg | undefined;

    try {
        // Test basic connection pool
        console.log(`[DB-TEST] Creating connection pool...`);
        pool = new Pool({
            connectionString,
            max: 1,
            idleTimeoutMillis: 5000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
            application_name: "kenge_isp_test"
        });

        adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });

        // Test 1: Basic connection
        console.log(`[DB-TEST] Testing basic connection...`);
        const startTime = Date.now();
        await prisma.$queryRaw`SELECT 1 as test`;
        const connectionTime = Date.now() - startTime;
        console.log(`✅ Basic connection successful (${connectionTime}ms)`);

        // Test 2: Check if tables exist
        console.log(`[DB-TEST] Checking database schema...`);
        const tables = await prisma.$queryRaw<{ table_name: string }[]>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;

        console.log(`📋 Found ${tables.length} tables:`);
        for (const table of tables) {
            console.log(`   - ${table.table_name}`);
        }

        // Test 3: Check SaaS plans
        console.log(`[DB-TEST] Checking SaaS plans...`);
        const plansCount = await prisma.saasPlan.count();
        console.log(`📊 SaaS plans count: ${plansCount}`);

        if (plansCount > 0) {
            const plans = await prisma.saasPlan.findMany();
            for (const plan of plans) {
                console.log(`   - ${plan.name}: ${plan.price} TZS (${plan.clientLimit} clients)`);
            }
        }

        // Test 4: Check users
        console.log(`[DB-TEST] Checking users...`);
        const usersCount = await prisma.user.count();
        console.log(`👥 Users count: ${usersCount}`);

        if (usersCount > 0) {
            const superAdmins = await prisma.user.count({
                where: { role: "SUPER_ADMIN" }
            });
            console.log(`👑 Super Admin users: ${superAdmins}`);
        }

        console.log(`\n🎉 Database connection test completed successfully!`);
        console.log(`✅ All tests passed - database is ready for use.`);

    } catch (error) {
        console.error(`\n❌ Database connection test failed:`);
        const err = error as Error;
        console.error(`   Error: ${err.message}`);

        if ('code' in err && err.code) {
            console.error(`   Code: ${err.code}`);
        }

        console.error(`\n🔍 Troubleshooting:`);

        if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
            console.error(`   - Database host not reachable`);
            console.error(`   - Check DATABASE_URL format and network connectivity`);
        } else if (err.message.includes('authentication failed')) {
            console.error(`   - Database credentials incorrect`);
            console.error(`   - Check DATABASE_URL username/password`);
        } else if (err.message.includes('does not exist')) {
            console.error(`   - Database does not exist`);
            console.error(`   - Check DATABASE_URL database name`);
        } else if (err.message.includes('relation') && err.message.includes('does not exist')) {
            console.error(`   - Tables not created yet`);
            console.error(`   - Run migrations first: npx prisma migrate deploy`);
        }

        process.exit(1);
    } finally {
        if (prisma) {
            await prisma.$disconnect();
        }
        if (pool) {
            await pool.end();
        }
    }
}

testConnection();