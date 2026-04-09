import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    console.log("--- Users for tenant_admin ---");
    const users = await prisma.user.findMany({
        where: { tenantId: "tenant_admin" }
    });

    users.forEach(u => {
        console.log(`User: ${u.username} (ID: ${u.id})`);
        console.log(`  Email: ${u.email}`);
        console.log(`  Role: ${u.role}`);
        console.log(`  Status: ${u.status}`);
        console.log("---------------------------");
    });

    await prisma.$disconnect();
}

main().catch(console.error);
