const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
    const subs = await prisma.subscription.findMany({ take: 2 });
    console.log("Subscriptions:\n", JSON.stringify(subs, null, 2));

    const txs = await prisma.transaction.findMany({ take: 2 });
    console.log("Transactions:\n", JSON.stringify(txs, null, 2));
    
    // Test the backend dateUtils
    const { formatSafeDate } = require('./src/lib/dateUtils');
    console.log("Test formatSafeDate:", formatSafeDate(subs[0]?.createdAt, true));
}

main().finally(() => prisma.$disconnect());
