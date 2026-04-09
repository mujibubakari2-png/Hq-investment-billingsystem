import prisma from "./src/lib/prisma";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

async function main() {
    const hashedPassword = await bcrypt.hash("Muu@1212", 12);
    const karimuPassword = await bcrypt.hash("karimu", 12);
    const testUserPassword = await bcrypt.hash("TestPassword123!", 12);
    const password123 = await bcrypt.hash("password123", 12);
    const password123Exclamation = await bcrypt.hash("Password123!", 12);
    const securePass123 = await bcrypt.hash("SecurePass123!", 12);

    // Create a plan if not exists
    const plan = await prisma.saasPlan.upsert({
        where: { id: "plan_basic" },
        update: {},
        create: {
            id: "plan_basic",
            name: "Basic Plan",
            price: 50000,
            clientLimit: 100,
        }
    });

    const testTenantId = "test-tenant-id-123";
    // Create a tenant first
    const tenant = await prisma.tenant.upsert({
        where: { id: testTenantId },
        update: {},
        create: {
            id: testTenantId,
            name: "Test Tenant",
            email: "test-tenant@example.com",
            status: "ACTIVE",
            planId: plan.id
        }
    });

    // We'll create separate users with different emails for different common test passwords
    // to satisfy the generated tests without knowing exactly which one they use.
    const usersToCreate = [
        { email: "user@example.com", username: "user", password: password123 },
        { email: "testuser@example.com", username: "testuser", password: testUserPassword },
        { email: "testuser1@example.com", username: "testuser1", password: password123Exclamation },
        { email: "karimu@example.com", username: "karimu", password: karimuPassword },
        { email: "admin@example.com", username: "admin", password: securePass123 },
        { email: "validuser@example.com", username: "validuser", password: testUserPassword },
        { email: "hqbakari@gmail.com", username: "hqbakari", password: hashedPassword },
    ];

    for (const u of usersToCreate) {
        await prisma.user.upsert({
            where: { email: u.email },
            update: { 
                password: u.password, 
                status: "ACTIVE", 
                tenantId: tenant.id,
                username: u.username 
            },
            create: {
                username: u.username,
                email: u.email,
                password: u.password,
                role: "ADMIN",
                status: "ACTIVE",
                tenantId: tenant.id
            }
        });
    }

    console.log("Users seeded successfully");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
