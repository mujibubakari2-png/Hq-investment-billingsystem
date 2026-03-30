const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
    const user = await p.user.findFirst({
        where: { email: 'hqbakari@gmail.com' },
        select: { id: true, username: true, role: true, tenantId: true }
    });
    console.log('USER:', JSON.stringify(user, null, 2));

    const routers = await p.router.findMany({
        select: { id: true, name: true, host: true, tenantId: true }
    });
    console.log('ALL ROUTERS:', JSON.stringify(routers, null, 2));

    const tenants = await p.tenant.findMany({
        select: { id: true, name: true, email: true }
    });
    console.log('TENANTS:', JSON.stringify(tenants, null, 2));

    await p.$disconnect();
}
check().catch(e => { console.error(e); p.$disconnect(); });
