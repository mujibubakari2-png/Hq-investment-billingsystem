import prisma from "./src/lib/prisma";

async function main() {
    console.log("Testing Prisma...");
    try {
        const users = await prisma.user.findMany();
        console.log("Users:", users.length);
    } catch (e) {
        console.error("Prisma Error:", e);
    } finally {
        // await prisma.$disconnect();
        process.exit(0);
    }
}

main();
