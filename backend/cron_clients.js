const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// A simple local wrapper to simulate getMikroTikService behavior in a node script
async function getMikroTikService(routerId) {
    // You would normally import or replicate the MikroTikService logic here 
    // to actually call the MikroTik API. For now, we update the DB states.
    return {
        suspendService: async (username, serviceType) => {
            console.log(`[MikroTik Mock] Suspending ${serviceType} user ${username} on router ${routerId}`);
            // Provide actual mikrotik REST API suspension here
        }
    };
}

async function checkClientSubscriptions() {
    console.log(`[${new Date().toISOString()}] Starting Client Subscription Check...`);
    const now = new Date();

    try {
        // Find subscriptions that are ACTIVE but past their expiresAt date
        const expiredSubscribers = await prisma.subscription.findMany({
            where: {
                status: "ACTIVE",
                expiresAt: { lt: now }
            },
            include: { client: true, package: true }
        });

        if (expiredSubscribers.length === 0) {
            console.log("No expired subscriptions found.");
        }

        for (const sub of expiredSubscribers) {
            console.log(`Suspending client ${sub.client.username} (Sub ID: ${sub.id})...`);

            try {
                // 1. If Mikrotik router exists, suspend them natively
                if (sub.routerId) {
                    const mikrotik = await getMikroTikService(sub.routerId);
                    const type = sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                    await mikrotik.suspendService(sub.client.username, type);
                    
                    await prisma.routerLog.create({
                        data: {
                            routerId: sub.routerId,
                            action: "AUTO_SUSPEND_USER",
                            details: `Subscription expired for ${sub.client.username}`,
                            status: "success",
                            username: sub.client.username
                        }
                    });
                }

                // 2. Update DB Subscription
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: { 
                        status: "EXPIRED",
                        syncStatus: sub.routerId ? "SYNCED" : "N/A"
                    }
                });

                // 3. Update Client Status (only if they have no other active subscriptions)
                const otherActiveSubs = await prisma.subscription.count({
                    where: {
                        clientId: sub.clientId,
                        id: { not: sub.id },
                        status: "ACTIVE"
                    }
                });

                if (otherActiveSubs === 0) {
                    await prisma.client.update({
                        where: { id: sub.clientId },
                        data: { status: "EXPIRED" }
                    });
                }

                console.log(`Successfully suspended ${sub.client.username}.`);
            } catch (err) {
                console.error(`Error suspending ${sub.client.username}:`, err);
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: { syncStatus: "FAILED_SYNC" }
                });
            }
        }

        console.log(`[${new Date().toISOString()}] Client Subscription Check Completed.`);

    } catch (e) {
        console.error("Subscription Check Job Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

// Execute
checkClientSubscriptions();
