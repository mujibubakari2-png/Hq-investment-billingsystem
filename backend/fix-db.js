const { Client } = require('pg');

const databaseUrl = "postgresql://enterprisedb:Muu%4066487125@localhost:5444/kenge_isp?schema=public";

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    
    // Find all tenants that have a PAID invoice but are somehow restricted.
    // Actually, we can just find any invoices that are PAID and see if their tenant is SUSPENDED.
    const result = await client.query(`
      SELECT t.id, t.name, t.status, t."licenseExpiresAt", 
             SUM(i."packageMonths") as total_paid_months
      FROM tenants t
      JOIN tenant_invoices i ON t.id = i."tenantId"
      WHERE i.status = 'PAID'
      GROUP BY t.id, t.name, t.status, t."licenseExpiresAt"
    `);

    let fixedCount = 0;

    for (const row of result.rows) {
        const tenantId = row.id;
        const status = row.status;
        const expiresAt = row.licenseExpiresAt;
        const paidMonths = parseInt(row.total_paid_months) || 1;
        
        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        let neededUpdate = false;
        let newStatus = status;
        let newExpiresAt = expiresAt ? new Date(expiresAt) : new Date(now.getTime() - 1000); // Past

        if (status !== 'ACTIVE') {
            neededUpdate = true;
            newStatus = 'ACTIVE';
            
            // If they are locked out, re-baseline their expiry to today + package months
            if (newExpiresAt <= now) {
                newExpiresAt = new Date(now.getTime() + (paidMonths * thirtyDaysMs));
            } else {
                newExpiresAt = new Date(newExpiresAt.getTime() + (paidMonths * thirtyDaysMs));
            }
        } else if (newExpiresAt <= now) {
            // Even if ACTIVE, if expiry is in past but they DO have paid invoices (say from a manual activation that failed to set date)
            neededUpdate = true;
            newExpiresAt = new Date(now.getTime() + (paidMonths * thirtyDaysMs));
        }

        if (neededUpdate) {
            console.log(`Fixing tenant ${row.name} (ID: ${tenantId}) -> Status: ${newStatus}, Expiry: ${newExpiresAt.toISOString()}`);
            await client.query(`
                UPDATE tenants 
                SET status = $1, "licenseExpiresAt" = $2
                WHERE id = $3
            `, [newStatus, newExpiresAt, tenantId]);
            fixedCount++;
        }
    }

    console.log(`Successfully fixed ${fixedCount} tenants.`);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await client.end();
  }
}

run();
