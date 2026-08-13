const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanUpAdminUsernames() {
    try {
        console.log('Fetching routers...');
        const routers = await prisma.router.findMany();
        let updated = 0;

        for (const router of routers) {
            if (router.username && router.username.startsWith('hq_admin_')) {
                console.log(`Updating router ${router.name} (ID: ${router.id}): changing username from ${router.username} to admin`);
                await prisma.router.update({
                    where: { id: router.id },
                    data: { username: 'admin' },
                });
                updated++;
            }
        }

        console.log(`Successfully updated ${updated} routers.`);
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanUpAdminUsernames();
