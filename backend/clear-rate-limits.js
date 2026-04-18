const { PrismaClient } = require("./src/generated/prisma");

const prisma = new PrismaClient();

async function clearRateLimits() {
    const result = await prisma.rateLimit.deleteMany({
        where: {
            key: {
                startsWith: "login:"
            }
        }
    });
    console.log(`Deleted ${result.count} rate limit entries`);
    process.exit(0);
}

clearRateLimits().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
});
