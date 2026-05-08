const { Pool } = require('pg');
require('dotenv').config();

// Try both 5444 (from .env) and 5432 (from docker-compose)
const ports = [5444, 5432];

async function tryConnect(port) {
  const connectionString = process.env.DATABASE_URL.replace(/:[0-9]+\//, `:${port}/`);
  console.log(`Trying port ${port}... URL: ${connectionString.replace(/:[^:]+@/, ':***@')}`);
  
  const pool = new Pool({
    connectionString,
    ssl: false,
    connectionTimeoutMillis: 2000
  });

  try {
    const client = await pool.connect();
    console.log(`Successfully connected to port ${port}!`);
    const res = await client.query('SELECT current_database(), current_user');
    console.log('DB Info:', res.rows[0]);
    
    // Check tables
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tablesRes.rows.map(t => t.table_name).join(', '));

    const radacctCount = await client.query('SELECT COUNT(*) FROM radacct');
    console.log(`Total records in radacct: ${radacctCount.rows[0].count}`);

    const nasIps = await client.query('SELECT nasipaddress, COUNT(*) FROM radacct GROUP BY nasipaddress');
    console.table(nasIps.rows);

    const routers = await client.query('SELECT name, host, "wgTunnelIp", "tenantId" FROM routers');
    console.table(routers.rows);

    client.release();
    return true;
  } catch (e) {
    console.error(`Failed to connect to port ${port}: ${e.message}`);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  for (const port of ports) {
    if (await tryConnect(port)) break;
  }
}

main();
