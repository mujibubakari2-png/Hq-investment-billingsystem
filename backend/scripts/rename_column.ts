import "dotenv/config";
import { Pool } from "pg";

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("DATABASE_URL not set");
        process.exit(1);
    }
    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        console.log("Renaming clientLimit to pppoeLimit...");
        await pool.query('ALTER TABLE "saas_plans" RENAME COLUMN "clientLimit" TO "pppoeLimit"');
        console.log("Column renamed successfully.");
    } catch (e: any) {
        if (e.message.includes('does not exist')) {
            console.log("Column might already be renamed or missing:", e.message);
        } else {
            console.error("Error renaming column:", e.message);
        }
    }

    try {
        console.log("Adding maxRouters and hotspotLimit...");
        await pool.query('ALTER TABLE "saas_plans" ADD COLUMN IF NOT EXISTS "maxRouters" INTEGER NOT NULL DEFAULT 1');
        await pool.query('ALTER TABLE "saas_plans" ADD COLUMN IF NOT EXISTS "hotspotLimit" INTEGER');
        console.log("Columns added successfully.");
    } catch (e: any) {
        console.error("Error adding columns:", e.message);
    }

    await pool.end();
}

main();
