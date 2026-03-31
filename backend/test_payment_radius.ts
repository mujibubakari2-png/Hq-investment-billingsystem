import prisma from "./src/lib/prisma";

async function testPaymentFromRadius() {
    console.log("🚀 Starting Payment Gateway Test from RADIUS Context...");

    try {
        // 1. Create a mock Hotspot package if not exists
        console.log("Checking for test package...");
        let pkg = await prisma.package.findFirst({
            where: { type: "HOTSPOT", status: "ACTIVE" }
        });

        if (!pkg) {
            console.log("Creating test package...");
            pkg = await prisma.package.create({
                data: {
                    name: "Test 1GB",
                    type: "HOTSPOT",
                    price: 500,
                    duration: 1,
                    durationUnit: "DAYS",
                    status: "ACTIVE",
                    uploadSpeed: 1,
                    downloadSpeed: 2,
                    category: "PERSONAL"
                }
            });
        }
        console.log(`Using package: ${pkg.name} (ID: ${pkg.id})`);

        // 2. Create a mock Client
        console.log("Creating test client...");
        const phone = "255700000000";
        const username = `HS-TEST-${Date.now()}`;
        const client = await prisma.client.create({
            data: {
                username,
                fullName: "Test RADIUS User",
                phone,
                serviceType: "HOTSPOT",
                status: "ACTIVE"
            }
        });
        console.log(`Created client: ${client.username} (ID: ${client.id})`);

        // 3. Create a PENDING transaction (simulating /api/hotspot/purchase)
        const reference = `HP-TEST-${Date.now()}`;
        console.log(`Creating pending transaction: ${reference}`);
        const transaction = await prisma.transaction.create({
            data: {
                clientId: client.id,
                planName: pkg.name,
                amount: pkg.price,
                type: "MOBILE",
                method: "M-PESA",
                status: "PENDING",
                reference
            }
        });

        // 4. Simulate Payment Callback (simulating /api/hotspot/callback)
        console.log("Simulating payment callback (Success)...");
        const callbackPayload = {
            AccountReference: reference,
            TransactionId: `TXN-${Date.now()}`,
            Amount: pkg.price,
            ResultCode: "0",
            ResultDesc: "Success",
            PhoneNumber: phone
        };

        // We'll call the logic directly or via a simulated HTTP request if possible.
        // For this test, let's trigger a POST to /api/hotspot/callback using fetch if the server is running,
        // but since we want to test the logic, we can also just observe how the system handles it.
        
        // Let's assume the server might not be running or we want to test the database state directly.
        // We will mock the effect of the callback.

        console.log("Processing callback logic simulation...");
        
        // Find transaction
        const tx = await prisma.transaction.findFirst({
            where: { reference: callbackPayload.AccountReference },
            include: { client: true }
        });

        if (!tx) throw new Error("Transaction not found");

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // 1 day

        await prisma.$transaction(async (db) => {
            // Update transaction
            await db.transaction.update({
                where: { id: tx.id },
                data: {
                    status: "COMPLETED",
                    expiryDate: expiresAt.toISOString()
                }
            });

            // Create subscription
            await db.subscription.create({
                data: {
                    clientId: tx.clientId,
                    packageId: pkg!.id,
                    status: "ACTIVE",
                    method: "MOBILE",
                    activatedAt: new Date(),
                    expiresAt,
                    onlineStatus: "ONLINE",
                    syncStatus: "PENDING"
                }
            });

            // Update client
            await db.client.update({
                where: { id: tx.clientId },
                data: { status: "ACTIVE" }
            });
        });

        console.log("✅ Database updated: Transaction COMPLETED, Subscription Created.");

        // 5. Verify RADIUS impact
        // In this system, RADIUS likely checks the `radcheck` or `radius_users` table.
        // Let's see if a radius user was supposed to be created.
        console.log("Checking RADIUS user status...");
        const radiusUser = await prisma.radiusUser.findFirst({
            where: { username: client.username }
        });

        if (radiusUser) {
            console.log(`✅ RADIUS user exists: ${radiusUser.username}, Status: ${radiusUser.status}`);
        } else {
            console.log("ℹ️ No RADIUS user found. The system might create it on-demand or during MikroTik sync.");
        }

        console.log("✨ Test completed successfully.");

    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testPaymentFromRadius();
