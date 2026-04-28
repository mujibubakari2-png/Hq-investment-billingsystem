import prisma from "../src/lib/prisma";
import { getMikroTikService } from "../src/lib/mikrotik";

/**
 * ISP Subscriber Expiration Job
 * 
 * This script finds all active subscriptions that have passed their expiration date,
 * connects to the respective MikroTik router to disable the service,
 * and updates the database records.
 */
async function checkClientSubscriptions() {
    console.log(`[${new Date().toISOString()}] Starting ISP Subscriber Expiration Check...`);
    const now = new Date();

    try {
        // 1. Find subscriptions that are ACTIVE but past their expiresAt date
        const expiredSubscribers = await prisma.subscription.findMany({
            where: {
                status: "ACTIVE",
                expiresAt: { lt: now }
            },
            include: { 
                client: true, 
                package: true,
                router: true
            }
        });

        if (expiredSubscribers.length === 0) {
            console.log("No expired subscriptions found.");
            return;
        }

        console.log(`Found ${expiredSubscribers.length} expired subscriptions to process.`);

        for (const sub of expiredSubscribers) {
            if (!sub.client) {
                console.warn(`[Warning] Subscription ${sub.id} has no associated client. Skipping.`);
                continue;
            }

            const username = sub.client.username;
            console.log(`Processing suspension for: ${username} (Sub ID: ${sub.id})`);

            try {
                // 2. Physical Suspension on MikroTik
                if (sub.routerId) {
                    try {
                        const mikrotik = await getMikroTikService(sub.routerId);
                        const serviceType = sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                        
                        console.log(`[MikroTik] Suspending ${serviceType} user ${username} on router ${sub.router?.name || sub.routerId}...`);
                        await mikrotik.suspendService(username, serviceType);
                        
                        // Mark as synced if MikroTik call succeeded
                        await prisma.subscription.update({
                            where: { id: sub.id },
                            data: { syncStatus: "SYNCED" }
                        });
                    } catch (mtErr: any) {
                        console.error(`[MikroTik Error] Failed to suspend ${username} on router:`, mtErr.message);
                        // Mark as failed sync so we know to retry or check manually
                        await prisma.subscription.update({
                            where: { id: sub.id },
                            data: { syncStatus: "FAILED_SYNC" }
                        });
                        
                        await prisma.routerLog.create({
                            data: {
                                routerId: sub.routerId,
                                action: "AUTO_SUSPEND_FAILED",
                                details: `Failed to suspend ${username} on MikroTik: ${mtErr.message}`,
                                status: "error",
                                username: username,
                                tenantId: sub.tenantId
                            }
                        });
                        // We continue with the DB update even if MikroTik fails, 
                        // so the client is at least marked as expired in the system.
                    }
                }

                // 3. Update Subscription Status in DB
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: { 
                        status: "EXPIRED",
                    }
                });

                // 4. Update Client Status (only if they have no other active subscriptions)
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

                console.log(`[Success] ${username} marked as EXPIRED.`);
            } catch (err: any) {
                console.error(`[Fatal Error] Unexpected error processing ${username}:`, err.message);
            }
        }

        console.log(`[${new Date().toISOString()}] Expiration check completed.`);

    } catch (e: any) {
        console.error("[Job Error] Global failure in checkClientSubscriptions:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the job
checkClientSubscriptions().catch(err => {
    console.error("Unhandle exception in cron script:", err);
    process.exit(1);
});
