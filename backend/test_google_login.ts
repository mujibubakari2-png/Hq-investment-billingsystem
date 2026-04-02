import "dotenv/config";
import prisma from "./src/lib/prisma";

async function testGoogleLoginMock() {
    console.log("🚀 Starting Google Login Mock Test...");

    try {
        // --- 1. Create a mock Google JWT payload ---
        const email = `mock-user-${Date.now()}@gmail.com`;
        const fullName = "Mock Google User";
        
        // Simulating the payload structure inside a Google ID Token (Base64 part 1)
        const mockPayload = {
            email: email,
            name: fullName,
            sub: `google-sub-${Date.now()}`,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600
        };

        // Create a fake credential string: header.payload.signature
        const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64').replace(/=/g, "");
        const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64').replace(/=/g, "");
        const signature = "fake-signature";
        const mockCredential = `${header}.${payload}.${signature}`;

        console.log(`Simulating login for: ${email}`);

        // --- 2. Call the logic (Simulating the POST /api/auth/google endpoint) ---
        // We'll simulate the "Auto-Register" flow if the user doesn't exist.

        // Check if user exists
        let user = await prisma.user.findFirst({
            where: { OR: [{ email }, { username: email }] }
        });

        if (!user) {
            console.log("User not found, initiating Auto-Register flow...");

            // Get a SaaS plan
            let plan = await prisma.saasPlan.findFirst();
            if (!plan) {
                console.log("No SaaS plans found, creating a default one...");
                plan = await prisma.saasPlan.create({
                    data: { id: "test_plan", name: "Test Plan", price: 10000, clientLimit: 100 }
                });
            }

            const companyName = `${fullName}'s Company`;
            
            // Simulation of the database transaction in route.ts
            const result = await prisma.$transaction(async (tx) => {
                const trialStart = new Date();
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 10);

                const tenant = await tx.tenant.create({
                    data: {
                        name: companyName,
                        email,
                        status: "ACTIVE",
                        planId: plan!.id,
                        trialStart,
                        trialEnd,
                    }
                });

                const newUser = await tx.user.create({
                    data: {
                        fullName: fullName,
                        email,
                        username: email,
                        password: "MOCK_PASSWORD_HASH", // In real code it's hashed
                        role: "SUPER_ADMIN",
                        status: "ACTIVE",
                        tenantId: tenant.id
                    }
                });

                return { user: newUser, tenant };
            });

            user = result.user;
            console.log(`✅ Auto-Registered new user: ${user.username} with Tenant: ${result.tenant.name}`);
        } else {
            console.log(`✅ Logged in existing user: ${user.username}`);
        }

        // --- 3. Verify final state ---
        const finalUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { tenant: true }
        });

        if (finalUser && finalUser.tenantId) {
            console.log("Verification Successful:");
            console.log(`- User ID: ${finalUser.id}`);
            console.log(`- Role: ${finalUser.role}`);
            console.log(`- Tenant: ${finalUser.tenant?.name}`);
        } else {
            throw new Error("Verification failed: User or Tenant missing.");
        }

        console.log("✨ Google Login Test completed successfully.");

    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testGoogleLoginMock();
