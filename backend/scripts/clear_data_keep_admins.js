const pkg = require('pg');
const { Pool } = pkg;

const connectionString = "postgresql://enterprisedb:Muu@66487125@localhost:5444/kenge_isp?schema=public";
const pool = new Pool({ connectionString });

async function clearData() {
    try {
        console.log("Safely clearing operational data while keeping Admins...");

        // Order matters due to foreign keys if not using CASCADE, 
        // but CASCADE is safer for a full wipe of specific tables.
        const tablesToWipe = [
            'transactions',
            'subscriptions',
            'clients',
            'invoices',
            'invoice_items',
            'vouchers',
            'expenses',
            'router_logs',
            'sms_messages',
            'user_otps',
            'equipments',
            'hotspot_settings',
            'routers',
            'packages'
        ];

        for (const table of tablesToWipe) {
            try {
                const res = await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
                console.log(`Wiped table: ${table}`);
            } catch (e) {
                console.warn(`Could not wipe ${table}: ${e.message}`);
            }
        }

        // Optional: Keep users but clear non-admin users?
        // User said "keep admin record", implying we can remove agents/viewers if needed,
        // but usually just keeping the whole users table is what's meant by "keep admin".
        // I will just keep the users table as is.

        // Verify counts
        console.log("\nVerification:");
        const checkTables = ['clients', 'transactions', 'users', 'tenants'];
        for (const table of checkTables) {
            const countRes = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`${table}: ${countRes.rows[0].count} records remaining`);
        }

    } catch (e) {
        console.error("Clear data failed:", e);
    } finally {
        await pool.end();
    }
}

clearData();
