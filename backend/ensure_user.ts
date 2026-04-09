
import "dotenv/config";
import prisma from "./src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
    const email = "hqbakari@gmail.com";
    const password = "Muu@1212";
    const username = "hqbakari";
    const tenantId = "tenant_admin"; // Use the existing test tenant

    // Ensure tenant exists
    await prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: {
            id: tenantId,
            name: "Admin Tenant",
            email: "admin@example.com",
            status: "ACTIVE",
            plan: {
                connectOrCreate: {
                    where: { id: "free_trial" },
                    create: {
                        id: "free_trial",
                        name: "Free Trial",
                        price: 0,
                        clientLimit: 100
                    }
                }
            }
        }
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            tenantId
        },
        create: {
            email,
            username,
            password: hashedPassword,
            role: "ADMIN",
            fullName: "HQ Bakari",
            tenantId
        }
    });

    console.log("USER ENSURED:", JSON.stringify(user, null, 2));
}

main();
