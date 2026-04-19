import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
}

console.log(`[SEED] Database URL: ${connectionString.replace(/:[^:]+@/, ':***@')}`);

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("\n🌱 Starting database seed...\n");

    try {
        // Test connection
        console.log("[SEED] Testing database connection...");
        await prisma.$queryRaw`SELECT 1`;
        console.log("✅ Database connection successful\n");

        // 1. Seed SaaS Plans
        console.log("📋 Seeding SaaS Plans...");
        const existingPlans = await prisma.saasPlan.count();
        if (existingPlans === 0) {
            await prisma.saasPlan.createMany({
                data: [
                    { id: "free_trial", name: "10-Day Free Trial", price: 0, clientLimit: 10 },
                    { id: "plan_basic", name: "Basic Plan", price: 50000, clientLimit: 100 },
                    { id: "plan_standard", name: "Standard Plan", price: 150000, clientLimit: 500 },
                ],
                skipDuplicates: true
            });
            console.log("✅ SaaS Plans created.\n");
        } else {
            console.log(`⏭️  ${existingPlans} SaaS Plans already exist. Skipping.\n`);
        }

        // 2. Create Super Admin User
        console.log("👤 Creating Super Admin user...");
        const superAdminEmail = "superadmin@hqinvestment.co.tz";
        const superAdminPassword = "hq-admin-2026";
        const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

        const existing = await prisma.user.findUnique({
            where: { email: superAdminEmail }
        }).catch(err => {
            console.log(`⚠️  Cannot query users yet (migrations may still be running): ${err.message}`);
            return null;
        });

        if (existing) {
            await prisma.user.update({
                where: { id: existing.id },
                data: {
                    role: "SUPER_ADMIN",
                    password: hashedPassword,
                    tenantId: null
                }
            });
            console.log(`✅ Updated existing Super Admin: ${superAdminEmail}\n`);
        } else if (existing === null) {
            console.log("⏭️  Skipping user creation (tables not ready yet)\n");
        } else {
            await prisma.user.create({
                data: {
                    username: "superadmin",
                    email: superAdminEmail,
                    password: hashedPassword,
                    fullName: "Platform Super Admin",
                    role: "SUPER_ADMIN",
                    status: "ACTIVE",
                    tenantId: null
                }
            });
            console.log(`✅ Created new Super Admin: ${superAdminEmail}\n`);
        }

        // 3. Demote other Super Admins
        const others = await prisma.user.updateMany({
            where: {
                email: { not: superAdminEmail },
                role: "SUPER_ADMIN"
            },
            data: {
                role: "ADMIN"
            }
        }).catch(() => ({ count: 0 }));

        if (others.count > 0) {
            console.log(`✅ Demoted ${others.count} other users from SUPER_ADMIN to ADMIN.\n`);
        }

        console.log("🎉 Database seed completed successfully!");
        console.log(`\n📧 Super Admin Credentials:`);
        console.log(`   Email: ${superAdminEmail}`);
        console.log(`   Password: ${superAdminPassword}\n`);

    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
