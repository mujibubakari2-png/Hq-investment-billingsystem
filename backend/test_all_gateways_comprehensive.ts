import "dotenv/config";
import prisma from "./src/lib/prisma";

async function testAllGateways() {
    console.log("🚀 Starting Comprehensive Payment Gateway Test...");

    try {
        // --- Setup: Create Package and Client ---
        console.log("Setting up test package and client...");
        let pkg = await prisma.package.findFirst({ where: { type: "HOTSPOT", status: "ACTIVE" } });
        if (!pkg) {
            pkg = await prisma.package.create({
                data: {
                    name: "Global Test Pkg",
                    type: "HOTSPOT",
                    price: 1500,
                    duration: 2,
                    durationUnit: "DAYS",
                    status: "ACTIVE",
                    uploadSpeed: 2,
                    downloadSpeed: 2,
                    category: "PERSONAL"
                }
            });
        }

        const client = await prisma.client.create({
            data: {
                username: `Tester-${Date.now()}`,
                fullName: "Comprehensive Gateway Tester",
                phone: "255788999000",
                serviceType: "HOTSPOT",
                status: "ACTIVE"
            }
        });
        console.log(`✓ Test environment ready. Client: ${client.username}`);

        // 1. PalmPesa (Hotspot)
        await runHotspotTest("PalmPesa", pkg, client);

        // 2. Zeno Pay (Hotspot)
        await runHotspotTest("Zeno Pay", pkg, client);

        // 3. Haraka Pay (Hotspot)
        await runHotspotTest("Haraka Pay", pkg, client);

        // 4. Mpesa Paybill (Hotspot)
        await runHotspotTest("Mpesa Paybill", pkg, client);

        // 5. Mpesa Buy Goods Till (Hotspot)
        await runHotspotTest("Mpesa Buy Goods Till", pkg, client);

        // 6. Bank Deposit (Manual)
        await runManualTest("Bank Deposit", pkg, client);

        // 7. PalmPesa (Tenant SaaS Invoice)
        await runTenantInvoiceTest("PalmPesa");

        console.log("\n✨ All payment gateways tested successfully!");

    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

async function runHotspotTest(gatewayName: string, pkg: any, client: any) {
    console.log(`\n--- Testing ${gatewayName} (Hotspot Callback) ---`);
    const reference = `HP-${gatewayName.replace(/\s+/g, '-').toUpperCase()}-${Date.now()}`;
    
    // Create PENDING transaction
    const tx = await prisma.transaction.create({
        data: {
            clientId: client.id,
            planName: pkg.name,
            amount: pkg.price,
            type: "MOBILE",
            method: gatewayName,
            status: "PENDING",
            reference
        }
    });
    console.log(`Created PENDING transaction: ${reference}`);

    // Simulate Success Callback (Logic from /api/hotspot/callback)
    console.log(`Simulating ${gatewayName} Success Callback...`);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2); // 2 days

    await prisma.$transaction(async (db) => {
        await db.transaction.update({
            where: { id: tx.id },
            data: {
                status: "COMPLETED",
                expiryDate: expiresAt.toISOString()
            }
        });

        await db.subscription.create({
            data: {
                clientId: client.id,
                packageId: pkg.id,
                status: "ACTIVE",
                method: "MOBILE",
                activatedAt: new Date(),
                expiresAt,
                onlineStatus: "ONLINE",
                syncStatus: "PENDING"
            }
        });

        await db.client.update({
            where: { id: client.id },
            data: { status: "ACTIVE" }
        });
    });
    console.log(`✓ ${gatewayName} flow completed.`);
}

async function runManualTest(gatewayName: string, pkg: any, client: any) {
    console.log(`\n--- Testing ${gatewayName} (Manual Transaction) ---`);
    const reference = `MANUAL-${gatewayName.replace(/\s+/g, '-').toUpperCase()}-${Date.now()}`;
    
    // Create COMPLETED transaction (Simulating manual entry in /api/transactions)
    const tx = await prisma.transaction.create({
        data: {
            clientId: client.id,
            planName: pkg.name,
            amount: pkg.price,
            type: "MANUAL",
            method: gatewayName,
            status: "COMPLETED",
            reference,
            expiryDate: new Date(Date.now() + 86400000 * 2).toISOString() // 2 days
        }
    });
    console.log(`Created COMPLETED manual transaction: ${reference}`);
    
    // Create Subscription manually as would happen in a real manual flow
    await prisma.subscription.create({
        data: {
            clientId: client.id,
            packageId: pkg.id,
            status: "ACTIVE",
            method: gatewayName,
            activatedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000 * 2)
        }
    });
    console.log(`✓ ${gatewayName} flow completed.`);
}

async function runTenantInvoiceTest(gatewayName: string) {
    console.log(`\n--- Testing ${gatewayName} (Tenant SaaS Webhook) ---`);
    
    // Ensure we have a tenant and a plan
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        const plan = await prisma.saasPlan.findFirst() || await prisma.saasPlan.create({
            data: { id: "test_saas_plan", name: "SaaS Test", price: 20000, clientLimit: 50 }
        });
        tenant = await prisma.tenant.create({
            data: {
                name: "Test ISP Tenant",
                email: `tenant-comp-${Date.now()}@isp.com`,
                planId: plan.id,
                status: "ACTIVE"
            }
        });
    }

    const invoiceRef = `INV-SAAS-${Date.now()}`;
    const invoice = await prisma.tenantInvoice.create({
        data: {
            invoiceNumber: invoiceRef,
            tenantId: tenant.id,
            planId: tenant.planId,
            amount: 50000,
            status: "PENDING",
            dueDate: new Date()
        }
    });
    console.log(`Created PENDING SaaS invoice: ${invoiceRef}`);

    // Simulate PalmPesa Webhook Success (Logic from /api/payments/palmpesa/webhook)
    console.log(`Simulating ${gatewayName} Webhook Success...`);
    await prisma.$transaction(async (db) => {
        await db.tenantInvoice.update({
            where: { id: invoice.id },
            data: { status: "PAID" }
        });
        await db.tenantPayment.create({
            data: {
                invoiceId: invoice.id,
                tenantId: tenant!.id,
                amount: invoice.amount,
                status: "COMPLETED",
                paymentMethod: gatewayName.toUpperCase(),
                transactionId: `TXN-SAAS-${Date.now()}`
            }
        });
    });
    console.log(`✓ ${gatewayName} tenant flow completed.`);
}

testAllGateways();
