// HIGH-R-003 FIX: RADIUS online-status sync extracted from GET /api/dashboard
// into a standalone BullMQ repeatable job.
//
// Previously: every dashboard page-load (every ~30s per user) triggered
// heavy DB writes (subscription.updateMany x2) AND a full-table radacct scan.
// With 100 concurrent users this caused 200+ write transactions per minute
// from the dashboard alone — a major write amplification bug.
//
// Now: this job runs on a fixed 60-second schedule from a SINGLE worker,
// regardless of how many users are viewing the dashboard simultaneously.
//
// Setup — add to ecosystem.config.js:
//   name: 'radius-sync-worker'
//   script: 'npx tsx src/jobs/radiusSyncWorker.ts'
//   autorestart: true
//   max_restarts: 10
//
// Or register via BullMQ:
//   import { setupRadiusSyncSchedule } from '@/jobs/radiusSyncWorker';
//   await setupRadiusSyncSchedule();

import 'dotenv/config';
import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from '@/lib/queue';
import { getTenantClient } from '@/lib/tenantPrisma';
import { backfillRadiusAccountingTenants } from '@/lib/radiusTenant';
import logger from '@/lib/logger';
import { invalidateNamespace } from '@/lib/cache';

const QUEUE_NAME = 'radius-sync';
const JOB_NAME  = 'sync-online-status';

// ── Queue + repeatable job registration ───────────────────────────────────────

export async function setupRadiusSyncSchedule(): Promise<void> {
    const conn = getRedisConnection();
    const queue = new Queue(QUEUE_NAME, { connection: conn });

    // Register as a repeatable every 60 s (replaces the per-request mutex approach)
    await queue.upsertJobScheduler(
        'radius-sync-repeatable',
        { every: 60_000 },
        { name: JOB_NAME, opts: { removeOnComplete: 5, removeOnFail: 10 } }
    );

    logger.info('[RadiusSync] Repeatable job registered', { interval: '60s' });
    await queue.close();
}

// ── Worker ────────────────────────────────────────────────────────────────────

async function processSync(_job: Job): Promise<void> {
    const globalDb = getTenantClient(null);

    // 1. Backfill tenantId on any radacct rows that are missing it
    try {
        await backfillRadiusAccountingTenants(globalDb);
    } catch (err) {
        logger.error('[RadiusSync] backfillRadiusAccountingTenants failed', {
            error: err instanceof Error ? err.message : String(err),
        });
    }

    // 2. Find all tenants that have at least one ACTIVE subscription
    const tenants = await globalDb.$queryRaw<{ tenantId: string }[]>`
        SELECT DISTINCT "tenantId" FROM subscriptions
        WHERE status = 'ACTIVE' AND "tenantId" IS NOT NULL
    `;

    for (const { tenantId } of tenants) {
        try {
            const db = getTenantClient(tenantId);

            const [activeSessions, activeSubscriptions] = await Promise.all([
                db.radAcct.findMany({
                    where: { acctstoptime: null, tenantId },
                    select: { username: true },
                    distinct: ['username'],
                }),
                db.subscription.findMany({
                    where: { status: 'ACTIVE', tenantId },
                    select: { id: true, onlineStatus: true, client: { select: { username: true } } },
                }),
            ]);

            const onlineUsernames = new Set(activeSessions.map(s => s.username));

            const toSetOnline: string[] = [];
            const toSetOffline: string[] = [];

            for (const sub of activeSubscriptions as any[]) {
                const username = sub.client?.username;
                if (!username) continue;
                if (onlineUsernames.has(username) && sub.onlineStatus !== 'ONLINE') {
                    toSetOnline.push(sub.id);
                } else if (!onlineUsernames.has(username) && sub.onlineStatus !== 'OFFLINE') {
                    toSetOffline.push(sub.id);
                }
            }

            const updates: Promise<unknown>[] = [];
            if (toSetOnline.length > 0) {
                updates.push(db.subscription.updateMany({
                    where: { id: { in: toSetOnline } },
                    data: { onlineStatus: 'ONLINE' },
                }));
            }
            if (toSetOffline.length > 0) {
                updates.push(db.subscription.updateMany({
                    where: { id: { in: toSetOffline } },
                    data: { onlineStatus: 'OFFLINE' },
                }));
            }
            await Promise.all(updates);

            if (toSetOnline.length > 0 || toSetOffline.length > 0) {
                // Invalidate dashboard cache for this tenant so next page-load is fresh
                await invalidateNamespace(tenantId, 'dashboard');
                logger.info('[RadiusSync] Updated online status', {
                    tenantId,
                    online: toSetOnline.length,
                    offline: toSetOffline.length,
                });
            }
        } catch (err) {
            logger.error('[RadiusSync] Failed to sync tenant', {
                tenantId,
                error: err instanceof Error ? err.message : String(err),
            });
            // Continue with other tenants even if one fails
        }
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
    const conn = getRedisConnection();
    await setupRadiusSyncSchedule();

    const worker = new Worker(QUEUE_NAME, processSync, {
        connection: conn,
        concurrency: 1, // Serial — only one sync at a time
    });

    worker.on('completed', (job) => {
        logger.info('[RadiusSync] Sync complete', { jobId: job.id });
    });

    worker.on('failed', (job, err) => {
        logger.error('[RadiusSync] Sync failed', {
            jobId: job?.id,
            error: err.message,
        });
    });

    logger.info('[RadiusSync] Worker started, waiting for jobs...');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        await worker.close();
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        await worker.close();
        process.exit(0);
    });
}

main().catch((err) => {
    logger.error('[RadiusSync] Fatal startup error', { error: String(err) });
    process.exit(1);
});
