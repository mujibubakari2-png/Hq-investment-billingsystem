import "dotenv/config";
import { execSync } from "child_process";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.error("   Please set DATABASE_URL in your Railway dashboard");
    console.error("   Format: postgresql://user:password@host:port/database");
    process.exit(1);
}

console.log(`[MIGRATION-FIX] Attempting to fix database migrations...`);
console.log(`[MIGRATION-FIX] Database URL: ${connectionString.replace(/:[^:]+@/, ':***@')}`);
console.log(`[MIGRATION-FIX] Environment: ${process.env.NODE_ENV || 'development'}`);

async function fixMigrations() {
    try {
        console.log(`[MIGRATION-FIX] Step 1: Generating Prisma client...`);
        execSync("npx prisma generate", { stdio: "inherit" });
        console.log(`✅ Prisma client generated`);

        console.log(`[MIGRATION-FIX] Step 2: Running database migrations...`);
        execSync("npx prisma migrate deploy --skip-verify", { stdio: "inherit" });
        console.log(`✅ Migrations deployed`);

        console.log(`[MIGRATION-FIX] Step 3: Verifying migrations...`);
        execSync("node scripts/check-migrations.js", { stdio: "inherit" });
        console.log(`✅ Migrations verified`);

        console.log(`[MIGRATION-FIX] Step 4: Seeding database...`);
        execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
        console.log(`✅ Database seeded`);

        console.log(`[MIGRATION-FIX] Step 5: Final connection test...`);
        execSync("node scripts/test-db.js", { stdio: "inherit" });
        console.log(`✅ Connection test passed`);

        console.log(`\n🎉 Database migration fix completed successfully!`);
        console.log(`✅ All tables created and seeded`);
        console.log(`✅ Database is ready for use`);

    } catch (error) {
        console.error(`\n❌ Migration fix failed:`);
        const err = error as Error;
        console.error(`   Error: ${err.message}`);

        console.error(`\n🔍 Troubleshooting steps:`);
        console.error(`   1. Check DATABASE_URL format`);
        console.error(`   2. Verify database exists and is accessible`);
        console.error(`   3. Check Railway Postgres service status`);
        console.error(`   4. Review Railway deployment logs`);
        console.error(`   5. Try redeploying the backend service`);

        console.error(`\n💡 Manual fix commands (run in Railway CLI):`);
        console.error(`   railway run --service backend npx prisma migrate deploy`);
        console.error(`   railway run --service backend npx tsx scripts/seed.ts`);

        process.exit(1);
    }
}

fixMigrations();