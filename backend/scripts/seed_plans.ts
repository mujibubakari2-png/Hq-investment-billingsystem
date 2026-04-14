import prisma from "./src/lib/prisma";
import "dotenv/config";
async function main() {
    try {
        console.log("Checking for existing plans...");
        const count = await prisma.saasPlan.count();
        if (count > 0) {
            console.log("Plans already exist. Skipping.");
            return;
        }

        console.log("Creating SaaS Plans...");
        await prisma.saasPlan.createMany({
            data: [
                { id: "free_trial", name: "10-Day Free Trial", price: 0, clientLimit: 10 },
                { id: "plan_basic", name: "Basic Plan", price: 50000, clientLimit: 100 },
                { id: "plan_standard", name: "Standard Plan", price: 150000, clientLimit: 500 },
            ],
            skipDuplicates: true
        });
        console.log("✅ SaaS Plans seeded successfully.");
    } catch (e) {
        console.error("❌ Seed failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
