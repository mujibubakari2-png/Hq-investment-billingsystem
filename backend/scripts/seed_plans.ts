/**
 * Seed SaaS Plans (standalone script).
 *
 * Usage: npx tsx scripts/seed_plans.ts
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
    try {
        console.log("Checking for existing plans...");
        const count = await prisma.saasPlan.count();
        if (count > 0) {
            console.log(`⏭️  ${count} plans already exist. Skipping.`);
            const plans = await prisma.saasPlan.findMany({ orderBy: { price: "asc" } });
            console.table(plans.map(p => ({
                id: p.id,
                name: p.name,
                price: `${p.price.toLocaleString()} TSH`,
                pppoeLimit: p.clientLimit,
            })));
            return;
        }

        console.log("Creating SaaS Plans...");
        await prisma.saasPlan.createMany({
            data: [
                { id: "free_trial",      name: "10-Day Free Trial", price: 0,     clientLimit: 10   },
                { id: "plan_starter",    name: "Starter",           price: 15000, clientLimit: 150  },
                { id: "plan_business",   name: "Business",          price: 30000, clientLimit: 300  },
                { id: "plan_enterprise", name: "Enterprise",        price: 50000, clientLimit: 5000 },
            ],
            skipDuplicates: true,
        });
        console.log("✅ SaaS Plans seeded successfully.");
    } catch (e) {
        console.error("❌ Seed failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
