const { Client } = require('pg');
const passwords = ['postgres', 'admin', 'password', '1234', '123456', 'root', 'kenge', 'hqbak', 'kenge_isp', 'kengeisp', ''];

async function test() {
    for (const p of passwords) {
        const c = new Client({ connectionString: `postgresql://postgres:${p}@localhost:5432/kenge_isp?schema=public` });
        try {
            await c.connect();
            console.log('SUCCESS with password:', p);
            await c.end();
            return;
        } catch (e) {
            if (!e.message.includes('authentication failed')) {
                console.log('Other error with', p, ':', e.message);
            }
        }
    }
    console.log('NO passwords matched');
}

test();
