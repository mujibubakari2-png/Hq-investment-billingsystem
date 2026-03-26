import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function checkData() {
    try {
        console.log("Checking database...");
        const clientsCount = await prisma.client.count();
        const subCount = await prisma.subscription.count();
        const txCount = await prisma.transaction.count();
        const routersCount = await prisma.router.count();
        const routers = await prisma.router.findMany({ select: { name: true, status: true, host: true } });

        console.log({
            clientsCount,
            subCount,
            txCount,
            routersCount,
            routers
        });

        // Check recent transactions dates
        const recentTx = await prisma.transaction.findMany({ take: 5, orderBy: { createdAt: "desc" } });
        console.log("Recent Transactions Dates:");
        recentTx.forEach((t: any) => console.log(`${t.reference}: CreatedAt is ${typeof t.createdAt}, ${t.createdAt}`));

    } catch (e) {
        console.error("DB Check failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
