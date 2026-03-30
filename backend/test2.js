const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  try {
    const router = await prisma.router.findFirst();
    if (!router) { console.log('no router'); return; }
    console.log('Router:', router.id);
    const data = {
        primaryColor: '#1a1a2e',
        accentColor: '#6366f1',
        selectedFont: 'Inter',
        layout: 'grid',
        enableAds: false,
        adMessage: 'Welcome to our hotspot!',
        enableRememberMe: true,
        companyName: 'Test',
        customerCareNumber: ''
    };
    const settings = await prisma.hotspotSettings.upsert({
        where: { routerId: router.id },
        update: { ...data },
        create: {
            routerId: router.id,
            ...data,
            tenantId: router.tenantId || null,
        },
    });
    console.log('Success:', settings);
  } catch (e) {
    console.error('Error in upsert:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
