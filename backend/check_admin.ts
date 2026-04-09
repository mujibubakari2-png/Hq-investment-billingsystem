
import "dotenv/config";
import prisma from "./src/lib/prisma";

async function main() {
    const tenantId = "tenant_admin";
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
    
    await prisma.user.update({ where: { username: "admin" }, data: { tenantId } });
    const user = await prisma.user.findFirst({ where: { username: "admin" } });
    console.log("ADMIN USER UPDATED:", JSON.stringify(user, null, 2));
}

main();
