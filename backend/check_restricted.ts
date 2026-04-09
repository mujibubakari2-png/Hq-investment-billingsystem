import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kenge_isp";
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    console.log("--- Restricted Tenants ---");
    const restrictedTenants = await prisma.tenant.findMany({
        where: {
            OR: [
                { status: "SUSPENDED" },
                { licenseExpiresAt: { lt: new Date() } },
                { trialEnd: { lt: new Date() } }
            ]
        },
        include: {
            plan: true,
            tenantInvoices: {
                where: { status: "PENDING" }
            }
        }
    });

    if (restrictedTenants.length === 0) {
        console.log("No restricted tenants found.");
    } else {
        restrictedTenants.forEach(t => {
            console.log(`Tenant: ${t.name} (ID: ${t.id})`);
            console.log(`  Status: ${t.status}`);
            console.log(`  License Expires: ${t.licenseExpiresAt}`);
            console.log(`  Trial Ends: ${t.trialEnd}`);
            console.log(`  Plan: ${t.plan.name}`);
            console.log(`  Pending Invoices: ${t.tenantInvoices.length}`);
            t.tenantInvoices.forEach(inv => {
                console.log(`    Invoice ${inv.id}: ${inv.amount} (Due: ${inv.dueDate})`);
            });
            console.log("---------------------------");
        });
    }

    console.log("\n--- Restricted Users ---");
    const restrictedUsers = await prisma.user.findMany({
        where: {
            status: "INACTIVE"
        }
    });

    if (restrictedUsers.length === 0) {
        console.log("No restricted users found.");
    } else {
        restrictedUsers.forEach(u => {
            console.log(`User: ${u.username} (ID: ${u.id})`);
            console.log(`  Email: ${u.email}`);
            console.log(`  Status: ${u.status}`);
            console.log(`  Role: ${u.role}`);
            console.log("---------------------------");
        });
    }

    await prisma.$disconnect();
}

main().catch(console.error);
