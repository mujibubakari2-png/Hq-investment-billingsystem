import prisma from './src/lib/prisma';

async function main() {
    try {
        const plan = await prisma.saasPlan.create({
            data: {
                name: 'Test',
                price: 0,
                pppoeLimit: 100,
                hotspotLimit: null,
                maxRouters: 5
            }
        });
        console.log("Plan created:", plan.id);

        const tenant = await prisma.tenant.create({
            data: {
                name: 'T1',
                email: 't1@x.com',
                slug: 't1x',
                planId: plan.id
            }
        });
        console.log("Tenant created:", tenant.id);
    } catch (e: any) {
        console.error("PRISMA ERROR:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
