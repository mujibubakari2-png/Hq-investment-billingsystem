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

console.log(`[MIGRATION-CHECK] Checking database migrations...`);
console.log(`[MIGRATION-CHECK] Database URL: ${connectionString.replace(/:[^:]+@/, ':***@')}`);
console.log(`[MIGRATION-CHECK] Environment: ${process.env.NODE_ENV || 'development'}`);

async function checkMigrations() {
    let pool: Pool;
    let prisma: PrismaClient | undefined;
    let adapter: PrismaPg | undefined;

    try {
        // Create connection pool
        console.log(`[MIGRATION-CHECK] Creating database connection...`);
        pool = new Pool({
            connectionString,
            max: 1,
            idleTimeoutMillis: 5000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
            application_name: "kenge_isp_migration_check"
        });

        adapter = new PrismaPg(pool);
        prisma = new PrismaClient({ adapter });

        // Test basic connection
        console.log(`[MIGRATION-CHECK] Testing basic connection...`);
        await prisma.$queryRaw`SELECT 1 as test`;
        console.log(`✅ Database connection successful`);

        // Check if tables exist
        console.log(`[MIGRATION-CHECK] Checking for database tables...`);
        const tables = await prisma.$queryRaw<{ table_name: string }[]>`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;

        // List all tables found in the database
        console.log(`📋 Found ${tables.length} tables in database:`);
        if (tables.length > 0) {
            for (const table of tables) {
                console.log(`   - ${table.table_name}`);
            }
        } else {
            console.error(`❌ NO TABLES FOUND in 'public' schema!`);
            console.error(`   This means 'prisma db push' or 'prisma migrate deploy' did not run successfully.`);
            console.error(`   Please check your Railway build/deploy logs.`);
            process.exit(1);
        }

        // List all tables
        for (const table of tables) {
            console.log(`   - ${table.table_name}`);
        }

        // Check for key tables
        const expectedTables = ['users', 'clients', 'packages', 'subscriptions', 'invoices'];
        const missingTables = expectedTables.filter(expected =>
            !tables.some(table => table.table_name === expected)
        );

        if (missingTables.length > 0) {
            console.error(`❌ MISSING TABLES: ${missingTables.join(', ')}`);
            console.error(`   This indicates incomplete migration.`);
            process.exit(1);
        }

        // Check if tables have data
        console.log(`[MIGRATION-CHECK] Checking table contents...`);

        const userCount = await prisma.user.count();
        const clientCount = await prisma.client.count();
        const packageCount = await prisma.package.count();

        console.log(`📊 Table contents:`);
        console.log(`   - Users: ${userCount}`);
        console.log(`   - Clients: ${clientCount}`);
        console.log(`   - Packages: ${packageCount}`);

        if (userCount === 0) {
            console.warn(`⚠️  No users found - seed script may not have run`);
        }

        console.log(`\n🎉 Migration check completed successfully!`);
        console.log(`✅ All expected tables are present`);
        console.log(`✅ Database schema is properly deployed`);

    } catch (error) {
        console.error(`\n❌ Migration check failed:`);
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
            console.error(`   - Migrations failed to run`);
            console.error(`   - Check Railway logs for 'npx prisma migrate deploy' errors`);
        }

        console.error(`\n💡 To fix this issue:`);
        console.error(`   1. Check Railway backend service logs`);
        console.error(`   2. Look for migration errors during deploy phase`);
        console.error(`   3. Verify DATABASE_URL is set correctly`);
        console.error(`   4. Try redeploying the service`);

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

checkMigrations();