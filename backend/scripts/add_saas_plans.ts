import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = "postgresql://enterprisedb:Muu%4066487125@localhost:5444/kenge_isp";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        console.log("Creating requested SaaS Plans...");
        await prisma.saasPlan.createMany({
            data: [
                { id: "plan_15000", name: "Monthly 15,000 TSH - Unlimited Hotspot / 150 PPPoE", price: 15000, clientLimit: 150 },
                { id: "plan_30000", name: "Monthly 30,000 TSH - Unlimited Hotspot / 300 PPPoE", price: 30000, clientLimit: 300 },
                { id: "plan_50000", name: "Monthly 50,000 TSH - Unlimited Hotspot / 5000 PPPoE", price: 50000, clientLimit: 5000 },
            ],
            skipDuplicates: true
        });
        console.log("✅ New SaaS Plans seeded successfully!");

        const plans = await prisma.saasPlan.findMany({
            orderBy: { price: 'asc' }
        });
        console.log("Current plans in database:");
        console.log(plans);

    } catch (e) {
        console.error("❌ Action failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
