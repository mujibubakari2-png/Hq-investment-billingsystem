import prisma from './src/lib/prisma';

async function main() {
    console.log("Checking Users...");
    const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, role: true } });
    console.log("Users in DB:", users);

    console.log("\nChecking Dashboard API dependencies...");
    
    // Simulate dashboard queries
    try {
        console.log("Testing db.client.count...");
        await prisma.client.count();
        console.log("db.client.count OK");
    } catch(e: any) {
        console.error("db.client.count ERROR:", e.message);
    }

    try {
        console.log("Testing db.transaction.aggregate...");
        await prisma.transaction.aggregate({ _sum: { amount: true } });
        console.log("db.transaction.aggregate OK");
    } catch(e: any) {
        console.error("db.transaction.aggregate ERROR:", e.message);
    }
    
    try {
        console.log("Testing db.radAcct.count...");
        await prisma.radAcct.count();
        console.log("db.radAcct.count OK");
    } catch(e: any) {
        console.error("db.radAcct.count ERROR:", e.message);
    }
    
}
main().catch(console.error).finally(() => prisma.$disconnect());
