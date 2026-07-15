/**
 * RADIUS User Synchronization Worker — BullMQ
 *
 * RAD-W-001: Processes RADIUS user operations from the Redis queue asynchronously.
 * Run as a separate PM2 process (not part of Next.js cluster).
 *
 * PM2 config (ecosystem.config.js):
 *   { name: 'radius-worker', script: 'src/workers/radius.worker.ts',
 *     interpreter: 'node', interpreter_args: '-r ts-node/register', ... }
 */

import 'dotenv/config';
import { env } from '@/lib/env';
import { Worker, Job } from 'bullmq';
import { RadiusJobData } from '@/lib/radius-queue';
import { getRedisConnection } from '@/lib/redis';
import {
  syncRadiusUser,
  suspendRadiusUser,
  deleteRadiusUser,
} from '@/lib/radius';
import logger from '@/lib/logger';

void env;

const QUEUE_NAME = 'radius-sync';
const CONCURRENCY = 10; // Handle multiple RADIUS syncs in parallel

// ── Handlers ──────────────────────────────────────────────────────────────────

const handlers: Record<string, (data: RadiusJobData) => Promise<unknown>> = {
  'sync-user': async ({ tenantId, params }) => {
    const p = params as any;
    logger.info('[RadiusWorker] Syncing user', {
      username: p.username,
      tenantId,
    });

    const result = await syncRadiusUser({
      username: p.username,
      password: p.password,
      tenantId,
      fullName: p.fullName,
      expiresAt: p.expiresAt ? new Date(p.expiresAt) : undefined,
      status: p.status,
      rateLimit: p.rateLimit,
      profileName: p.profileName,
      simultaneousUse: p.simultaneousUse,
    });

    logger.info('[RadiusWorker] User synced', {
      username: p.username,
      tenantId,
      radiusUserId: (result as any)?.id,
    });

    return result;
  },

  'suspend-user': async ({ tenantId, params }) => {
    const p = params as any;
    logger.info('[RadiusWorker] Suspending user', {
      username: p.username,
      tenantId,
    });

    await suspendRadiusUser(p.username, tenantId);

    logger.info('[RadiusWorker] User suspended', {
      username: p.username,
      tenantId,
    });

    return { suspended: true };
  },

  'delete-user': async ({ tenantId, params }) => {
    const p = params as any;
    logger.info('[RadiusWorker] Deleting user', {
      username: p.username,
      tenantId,
    });

    await deleteRadiusUser(p.username, tenantId);

    logger.info('[RadiusWorker] User deleted', {
      username: p.username,
      tenantId,
    });

    return { deleted: true };
  },
};

// ── Worker ────────────────────────────────────────────────────────────────────

export function startRadiusWorker(): Worker<RadiusJobData> {
  const worker = new Worker<RadiusJobData>(
    QUEUE_NAME,
    async (job: Job<RadiusJobData>) => {
      const { name, idempotencyKey, tenantId } = job.data;
      logger.info(`[RadiusWorker] start: ${name}`, {
        jobId: job.id,
        idempotencyKey,
        tenantId,
      });

      const handler = handlers[name];
      if (!handler) throw new Error(`Unknown job type: ${name}`);

      try {
        const result = await handler(job.data);
        logger.info(`[RadiusWorker] done: ${name}`, { jobId: job.id });
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[RadiusWorker] failed: ${name}`, {
          jobId: job.id,
          error: msg,
          attempt: job.attemptsMade,
          idempotencyKey,
        });
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: CONCURRENCY,
      stalledInterval: 60_000,
    }
  );

  worker.on('completed', (job) =>
    logger.info(`[RadiusWorker] completed: ${job.data.name}`, { jobId: job.id })
  );
  worker.on('failed', (job, err) =>
    logger.error('[RadiusWorker] permanently failed', {
      jobId: job?.id,
      name: job?.data?.name,
      error: err.message,
    })
  );
  worker.on('error', (err) =>
    logger.error('[RadiusWorker] worker error', { error: err.message })
  );

  logger.info(`[RadiusWorker] started — concurrency: ${CONCURRENCY}`);
  return worker;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const worker = startRadiusWorker();
  const shutdown = async () => {
    logger.info('[RadiusWorker] shutting down...');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
