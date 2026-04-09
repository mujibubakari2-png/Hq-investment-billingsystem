import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = "postgresql://enterprisedb:Muu%4066487125@localhost:5444/kenge_isp?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    try {
        const email = "mujibubakari2@gmail.com";
        const passwordPlain = "Muu@1212";
        const hashedPassword = await bcrypt.hash(passwordPlain, 10);

        console.log("Restoring Super Admin account...");

        const existingUser = await prisma.user.findFirst({
            where: { email }
        });

        if (existingUser) {
            console.log("User found, updating to SUPER_ADMIN...");
            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    role: "SUPER_ADMIN",
                    password: hashedPassword,
                    tenantId: null 
                }
            });
            console.log("✅ Super Admin updated successfully!");
        } else {
            console.log("User not found, creating new Super Admin...");
            
            // Generate a unique username in case "mujibubakari2" is taken by another email
            const usernameStr = "mujibubakari2_" + Math.floor(Math.random() * 1000);
            
            await prisma.user.create({
                data: {
                    email: email,
                    username: "mujibubakari2_admin", 
                    password: hashedPassword,
                    role: "SUPER_ADMIN",
                    status: "ACTIVE",
                    fullName: "Mujibu Bakari",
                    tenantId: null
                }
            });
            console.log("✅ Super Admin created successfully!");
        }

    } catch (error) {
        console.error("❌ Error restoring Super Admin: ", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
