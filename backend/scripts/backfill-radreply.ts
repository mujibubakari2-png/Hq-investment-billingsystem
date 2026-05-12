/**
 * backfill-radreply.ts
 *
 * One-time script to populate radreply (Session-Timeout) for all
 * currently active subscriptions that are missing radreply entries.
 *
 * Run on the Droplet:
 *   cd /root/kenge/backend
 *   npx ts-node scripts/backfill-radreply.ts
 *   -- OR if ts-node is not available --
 *   node -e "require('./scripts/backfill-radreply.js')"
 *
 * This fixes the "RADIUS not respond" error by ensuring every active
 * RADIUS user has a Session-Timeout in the radreply table.
 */

import prisma from "../src/lib/prisma";
import { syncRadiusUser } from "../src/lib/radius";

async function main() {
    console.log("🔄 RADIUS radreply backfill starting...\n");

    // 1. Find all active subscriptions that have a package with a routerId
    const activeSubscriptions = await prisma.subscription.findMany({
        where: {
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
        },
        include: {
            client: true,
            package: true,
        },
    });

    console.log(`📋 Found ${activeSubscriptions.length} active subscriptions to process`);

    let synced = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of activeSubscriptions) {
        const client = sub.client;
        const pkg = sub.package;
        const tenantId = sub.tenantId || null;

        if (!client) {
            skipped++;
            continue;
        }

        try {
            // Check if radreply already has Session-Timeout for this user
            const existingReply = await prisma.radReply.findFirst({
                where: {
                    username: client.username,
                    tenantId,
                    attribute: "Session-Timeout",
                },
            });

            const expiresAt = sub.expiresAt;
            const remainingSecs = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

            if (existingReply && remainingSecs > 0) {
                // Already has Session-Timeout — update it to current remaining time
                await prisma.radReply.update({
                    where: { id: existingReply.id },
                    data: { value: String(remainingSecs) },
                });
                console.log(`  ✅ Updated radreply Session-Timeout for ${client.username} → ${remainingSecs}s`);
                synced++;
                continue;
            }

            if (remainingSecs <= 0) {
                console.log(`  ⚠️  Skipping ${client.username} — subscription expired ${Math.abs(remainingSecs)}s ago`);
                skipped++;
                continue;
            }

            // Build rate limit string from package
            let rateLimit: string | undefined;
            if (pkg.uploadSpeed && pkg.downloadSpeed) {
                const ulUnit = pkg.uploadUnit === "Mbps" ? "M" : "k";
                const dlUnit = pkg.downloadUnit === "Mbps" ? "M" : "k";
                rateLimit = `${pkg.uploadSpeed}${ulUnit}/${pkg.downloadSpeed}${dlUnit}`;
            }

            // Full sync — creates/updates both radcheck and radreply
            await syncRadiusUser({
                username: client.username,
                password: client.phone || undefined,
                tenantId,
                fullName: client.fullName || undefined,
                expiresAt,
                status: "Active",
                rateLimit,
            });

            console.log(`  ✅ Synced ${client.username} → Session-Timeout: ${remainingSecs}s${rateLimit ? ` | Rate: ${rateLimit}` : ""}`);
            synced++;
        } catch (err: any) {
            console.error(`  ❌ Failed for ${client.username}: ${err.message}`);
            failed++;
        }
    }

    // 2. Also sync all existing RadiusUsers that may have been created manually
    const radiusOnlyUsers = await prisma.radiusUser.findMany({
        where: { status: "Active" },
    });

    console.log(`\n📋 Found ${radiusOnlyUsers.length} RadiusUser records to verify`);

    for (const ru of radiusOnlyUsers) {
        try {
            const existing = await prisma.radReply.findFirst({
                where: { username: ru.username, tenantId: ru.tenantId, attribute: "Session-Timeout" },
            });

            if (!existing && ru.sessionTimeout && parseInt(ru.sessionTimeout) > 0) {
                await prisma.radReply.create({
                    data: {
                        username: ru.username,
                        attribute: "Session-Timeout",
                        op: "=",
                        value: ru.sessionTimeout,
                        tenantId: ru.tenantId,
                    },
                });
                console.log(`  ✅ Added Session-Timeout for RadiusUser ${ru.username}`);
                synced++;
            }
        } catch (err: any) {
            console.error(`  ❌ Failed RadiusUser ${ru.username}: ${err.message}`);
        }
    }

    console.log("\n══════════════════════════════════════");
    console.log(`✅ Synced  : ${synced}`);
    console.log(`⚠️  Skipped : ${skipped}`);
    console.log(`❌ Failed  : ${failed}`);
    console.log("══════════════════════════════════════\n");

    if (failed > 0) {
        console.log("⚠️  Some users failed. Check errors above and re-run the script.");
    } else {
        console.log("🎉 Backfill complete! RADIUS should now respond to MikroTik auth requests.");
        console.log("\nNext step — test on MikroTik terminal:");
        console.log("  /radius monitor 0");
        console.log("  (Then try connecting with a voucher or subscription)");
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error("💥 Backfill script crashed:", e);
    process.exit(1);
});
