/**
 * Add real production SaaS tenant plans.
 *
 * Usage:
 *   npx tsx scripts/add_saas_plans.ts
 *
 * Reads DATABASE_URL from .env — never hardcode credentials in scripts.
 */
import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
    try {
        console.log("Creating production SaaS Plans...");
        await prisma.saasPlan.createMany({
            data: [
                { id: "plan_starter",      name: "Starter",      price: 15000,  pppoeLimit: 150, hotspotLimit: null, maxRouters: 3 },
                { id: "plan_business",     name: "Business",     price: 30000,  pppoeLimit: 300, hotspotLimit: null, maxRouters: 5 },
                { id: "plan_enterprise",   name: "Enterprise",   price: 50000,  pppoeLimit: 5000, hotspotLimit: null, maxRouters: 10 },
            ],
            skipDuplicates: true,
        });
        console.log("✅ Production SaaS Plans created!");

        const plans = await prisma.saasPlan.findMany({ orderBy: { price: "asc" } });
        console.log("\nAll plans in database:");
        console.table(plans.map(p => ({
            id: p.id,
            name: p.name,
            price: `${p.price.toLocaleString()} TSH`,
            pppoeLimit: p.pppoeLimit,
        })));
    } catch (e) {
        console.error("❌ Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
