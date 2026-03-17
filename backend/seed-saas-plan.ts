import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parse } from "url";
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("🌱 Seeding SaaS Plan...");
    
    let plan = await prisma.saasPlan.findFirst();
    if (!plan) {
        plan = await prisma.saasPlan.create({
            data: {
                name: "Basic Plan",
                price: 100000,
                clientLimit: 500
            }
        });
        console.log("  ✓ Created basic SaaS plan:", plan.id);
    } else {
        console.log("  ✓ SaaS plan already exists:", plan.id);
    }
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
