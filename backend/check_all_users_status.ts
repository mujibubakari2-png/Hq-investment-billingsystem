import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    console.log("--- All Users with Tenant Status ---");
    const users = await prisma.user.findMany({
        include: { tenant: true }
    });

    users.forEach(u => {
        console.log(`User: ${u.username} (ID: ${u.id})`);
        console.log(`  Role: ${u.role}`);
        console.log(`  Status: ${u.status}`);
        console.log(`  Tenant: ${u.tenant?.name || 'NONE'} (Status: ${u.tenant?.status || 'N/A'})`);
        console.log("---------------------------");
    });

    await prisma.$disconnect();
}

main().catch(console.error);
