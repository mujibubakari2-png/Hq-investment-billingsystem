import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = "postgresql://enterprisedb:Muu%4066487125@localhost:5444/kenge_isp";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
import bcrypt from "bcryptjs";

async function main() {
    try {
        const superAdminEmail = "superadmin@hqinvestment.co.tz";
        const superAdminPassword = "hq-admin-2026";
        const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

        console.log("Setting up unique Super Admin account...");

        // 1. Check if the account already exists
        const existing = await prisma.user.findUnique({
            where: { email: superAdminEmail }
        });

        if (existing) {
            // Update to Super Admin role
            await prisma.user.update({
                where: { id: existing.id },
                data: {
                    role: "SUPER_ADMIN",
                    password: hashedPassword,
                    tenantId: null // Ensure global access
                }
            });
            console.log(`Updated existing account: ${superAdminEmail}`);
        } else {
            // Create new Super Admin account
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
            console.log(`Created new Super Admin account: ${superAdminEmail}`);
        }

        // 2. Demote all other users with SUPER_ADMIN to ADMIN
        const others = await prisma.user.updateMany({
            where: {
                email: { not: superAdminEmail },
                role: "SUPER_ADMIN"
            },
            data: {
                role: "ADMIN"
            }
        });

        console.log(`Demoted ${others.count} other users from SUPER_ADMIN to ADMIN.`);
        console.log("\nSuper Admin setup complete.");
        console.log(`Login Email: ${superAdminEmail}`);
        console.log(`Password: ${superAdminPassword}`);

    } catch (error) {
        console.error("Error setting up super admin:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
