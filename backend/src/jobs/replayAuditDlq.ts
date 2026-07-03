// Audit Log DLQ Replay Job
//
// HIGH-SEC-003 COMPANION: When writeAuditLog() cannot write to the DB, the event
// is pushed to Redis key "audit:dlq". This job replays those entries.
//
// Run every 5 min via PM2 cron in ecosystem.config.js:
//   cron_restart: '0,5,10,15,20,25,30,35,40,45,50,55 * * * *'
//   autorestart: false
//
// Or run manually: npx tsx src/jobs/replayAuditDlq.ts

import 'dotenv/config';
import { getRedisClient } from '@/lib/cache';
import { getTenantClient } from '@/lib/tenantPrisma';
import logger from '@/lib/logger';

const DLQ_KEY = 'audit:dlq';
const BATCH_SIZE = 50; // Process at most 50 events per run

async function main() {
    const redis = getRedisClient();
    if (!redis) {
        logger.error('[AuditDLQ] Redis unavailable — cannot replay DLQ');
        process.exit(1);
    }

    logger.info('[AuditDLQ] Starting DLQ replay...');
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < BATCH_SIZE; i++) {
        // RPOP: take the oldest entry (FIFO — LPUSH + RPOP)
        const raw = await redis.rpop(DLQ_KEY);
        if (!raw) break; // Queue empty

        let params: Record<string, unknown>;
        try {
            params = JSON.parse(raw);
        } catch {
            logger.warn('[AuditDLQ] Skipping unparseable entry', { raw: raw.slice(0, 200) });
            continue;
        }

        try {
            const db = getTenantClient(params.tenantId as string ?? null);
            await db.auditLog.create({
                data: {
                    tenantId: params.tenantId as string,
                    userId: params.userId as string,
                    action: params.action as string,
                    resource: params.resource as string,
                    resourceId: (params.resourceId as string) ?? null,
                    details: params.details as any ?? undefined,
                    ipAddress: (params.ipAddress as string) ?? null,
                    userAgent: (params.userAgent as string) ?? null,
                },
            });
            processed++;
        } catch (err) {
            failed++;
            logger.error('[AuditDLQ] Replay failed — pushing back to DLQ', {
                action: params.action,
                tenantId: params.tenantId,
                error: err instanceof Error ? err.message : String(err),
            });
            // Push back for next run
            await redis.rpush(DLQ_KEY, raw).catch(() => {});
        }
    }

    logger.info('[AuditDLQ] Replay complete', { processed, failed });
    await redis.quit();
    process.exit(0);
}

main().catch((err) => {
    logger.error('[AuditDLQ] Fatal error', { error: String(err) });
    process.exit(1);
});
