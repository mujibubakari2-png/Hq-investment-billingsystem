const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/kenge_isp' });
c.connect().then(async () => {
    const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables:', r.rows.map(r => r.table_name));
    c.end();
}).catch(e => { console.log('Error:', e.message); process.exit(1); });
