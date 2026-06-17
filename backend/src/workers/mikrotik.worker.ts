/**
 * MikroTik Job Worker — BullMQ
 *
 * MK-002: Processes MikroTik operations from the Redis queue asynchronously.
 * Run as a separate PM2 process (not part of Next.js cluster).
 *
 * PM2 config (ecosystem.config.js):
 *   { name: 'mikrotik-worker', script: 'src/workers/mikrotik.worker.ts',
 *     interpreter: 'node', interpreter_args: '-r ts-node/register', ... }
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, MikroTikJobData } from '@/lib/queue';
import { getMikroTikService } from '@/lib/mikrotik';
import { assertSafeRouterHost } from '@/lib/networkSafety';
import { decryptRouterFields } from '@/lib/encryption';
import { getTenantClient } from '@/lib/tenantPrisma';
import logger from '@/lib/logger';

const QUEUE_NAME = 'mikrotik-ops';
const CONCURRENCY = 5;

// ── Load router + build service ───────────────────────────────────────────────

async function getService(routerId: string) {
  const db = getTenantClient(null);
  const router = await db.router.findUnique({ where: { id: routerId } });
  if (!router) throw new Error(`Router not found: ${routerId}`);

  const dec = decryptRouterFields(router);
  assertSafeRouterHost(dec.host);

  const host = dec.host;
  const username = dec.username ?? 'admin';
  const password = dec.password ?? '';
  const port = dec.port ?? 8728;

  // getMikroTikService takes a routerId string — it handles DB lookup internally
  const service = await getMikroTikService(routerId);
  return { service, host };
}

// ── RouterLog helper ──────────────────────────────────────────────────────────

async function log(routerId: string, tenantId: string | null, action: string, status: 'success' | 'failed', details?: string) {
  const db = getTenantClient(null);
  await db.routerLog.create({
    data: { routerId, tenantId, action, status, details: details?.slice(0, 500) ?? null },
  }).catch(() => { });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

const handlers: Record<string, (data: MikroTikJobData) => Promise<unknown>> = {

  'create-pppoe-user': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    const r = await service.createPPPoEUser({
      name: payload.username as string,
      password: payload.password as string,
      service: 'pppoe',
      profile: payload.profile as string,
      disabled: false,
    });
    await log(routerId, tenantId, 'create-pppoe-user', 'success', `user: ${payload.username}`);
    return r;
  },

  'delete-pppoe-user': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    const r = await service.deletePPPoEUser(payload.username as string);
    await log(routerId, tenantId, 'delete-pppoe-user', 'success', `user: ${payload.username}`);
    return r;
  },

  'update-pppoe-user': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    const r = await service.updatePPPoEUser(payload.username as string, {
      password: payload.password as string | undefined,
      profile: payload.profile as string | undefined,
      disabled: payload.disabled as boolean | undefined,
    });
    await log(routerId, tenantId, 'update-pppoe-user', 'success', `user: ${payload.username}`);
    return r;
  },

  'create-hotspot-user': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    const r = await service.createHotspotUser({
      name: payload.username as string,
      password: payload.password as string,
      profile: payload.profile as string,
      server: 'all',
      disabled: false,
    });
    await log(routerId, tenantId, 'create-hotspot-user', 'success', `user: ${payload.username}`);
    return r;
  },

  'delete-hotspot-user': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    const r = await service.deleteHotspotUser(payload.username as string);
    await log(routerId, tenantId, 'delete-hotspot-user', 'success', `user: ${payload.username}`);
    return r;
  },

  'disconnect-session': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    // Use disconnectPPPoESession (the actual method name on MikroTikService)
    const r = await service.disconnectPPPoESession(payload.sessionId as string);
    await log(routerId, tenantId, 'disconnect-session', 'success', `session: ${payload.sessionId}`);
    return r;
  },

  'sync-subscription': async ({ routerId, tenantId, payload }) => {
    const { service } = await getService(routerId);
    const r = await service.updatePPPoEUser(payload.username as string, {
      profile: payload.profile as string | undefined,
      disabled: payload.disabled as boolean | undefined,
    });
    await log(routerId, tenantId, 'sync-subscription', 'success', `user: ${payload.username}`);
    return r;
  },
};

// ── Worker ────────────────────────────────────────────────────────────────────

export function startMikroTikWorker(): Worker<MikroTikJobData> {
  const worker = new Worker<MikroTikJobData>(
    QUEUE_NAME,
    async (job: Job<MikroTikJobData>) => {
      const { name, routerId, idempotencyKey, tenantId } = job.data;
      logger.info(`[Worker] start: ${name}`, { jobId: job.id, routerId, idempotencyKey });

      const handler = handlers[name];
      if (!handler) throw new Error(`Unknown job type: ${name}`);

      try {
        const result = await handler(job.data);
        logger.info(`[Worker] done: ${name}`, { jobId: job.id });
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Worker] failed: ${name}`, { jobId: job.id, error: msg, attempt: job.attemptsMade });
        await log(routerId, tenantId, name, 'failed', msg);
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: CONCURRENCY,
      stalledInterval: 60_000,
    }
  );

  worker.on('completed', (job) => logger.info(`[Worker] completed: ${job.data.name}`, { jobId: job.id }));
  worker.on('failed', (job, err) => logger.error('[Worker] permanently failed', { jobId: job?.id, name: job?.data?.name, error: err.message }));
  worker.on('error', (err) => logger.error('[Worker] worker error', { error: err.message }));

  logger.info(`[MikroTik Worker] started — concurrency: ${CONCURRENCY}`);
  return worker;
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (require.main === module) {
  const worker = startMikroTikWorker();
  const shutdown = async () => {
    logger.info('[Worker] shutting down...');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
