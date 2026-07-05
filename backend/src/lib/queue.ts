/**
 * MikroTik Job Queue — BullMQ
 *
 * MK-002 FIX: Moves all MikroTik write operations into an async job queue.
 * API routes enqueue a job and return 202 Accepted immediately.
 * A dedicated worker process executes the job with retries + backoff.
 *
 * Redis requirement:
 *   Add REDIS_URL to .env: redis://127.0.0.1:6379
 *   Install Redis: sudo apt install redis-server && sudo systemctl enable redis
 */

import { Queue, Job } from 'bullmq';
import logger from '@/lib/logger';
import { getRedisConnection } from '@/lib/redis';

// Re-export so callers that previously imported from queue.ts still work.
export { getRedisConnection } from '@/lib/redis';

// ── Job Types ─────────────────────────────────────────────────────────────────

export type MikroTikJobName =
  | 'create-pppoe-user'
  | 'delete-pppoe-user'
  | 'update-pppoe-user'
  | 'create-hotspot-user'
  | 'delete-hotspot-user'
  | 'update-hotspot-user'
  | 'disconnect-session'
  | 'set-bandwidth'
  | 'sync-subscription';

export interface MikroTikJobData {
  name: MikroTikJobName;
  routerId: string;
  idempotencyKey: string;
  tenantId: string | null;
  payload: Record<string, unknown>;
}

// ── Queue Singleton ───────────────────────────────────────────────────────────

const QUEUE_NAME = 'mikrotik-ops';
let _queue: Queue<MikroTikJobData> | null = null;

export function getMikroTikQueue(): Queue<MikroTikJobData> {
  if (!_queue) {
    _queue = new Queue<MikroTikJobData>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail:    { age: 7 * 24 * 3600 },
      },
    });
    _queue.on('error', (err) => {
      logger.error('[MikroTik Queue] error', { error: err.message });
    });
  }
  return _queue;
}

export async function closeMikroTikQueue(): Promise<void> {
  if (_queue) {
    try {
      await _queue.close();
    } catch {
      // ignore — queue may already be closed
    } finally {
      _queue = null;
    }
  }
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

export async function enqueueMikroTikOp(
  name: MikroTikJobName,
  routerId: string,
  payload: Record<string, unknown>,
  tenantId: string | null,
  idempotencyKey?: string
): Promise<{ jobId: string }> {
  const key = idempotencyKey ?? `${name}:${routerId}:${JSON.stringify(payload)}`;
  const queue = getMikroTikQueue();
  const job = await queue.add(
    name,
    { name, routerId, idempotencyKey: key, tenantId, payload },
    { jobId: key } // BullMQ deduplication
  );
  logger.info('[MikroTik Queue] enqueued', { jobId: job.id, name, routerId });
  return { jobId: job.id ?? key };
}

// ── Convenience Helpers ───────────────────────────────────────────────────────

export const enqueuePPPoECreate = (
  routerId: string, username: string, password: string, profile: string, tenantId: string | null
) => enqueueMikroTikOp('create-pppoe-user', routerId, { username, password, profile }, tenantId, `create-pppoe:${routerId}:${username}`);

export const enqueuePPPoEDelete = (
  routerId: string, username: string, tenantId: string | null
) => enqueueMikroTikOp('delete-pppoe-user', routerId, { username }, tenantId, `delete-pppoe:${routerId}:${username}`);

export const enqueueHotspotCreate = (
  routerId: string, username: string, password: string, profile: string, tenantId: string | null
) => enqueueMikroTikOp('create-hotspot-user', routerId, { username, password, profile }, tenantId, `create-hotspot:${routerId}:${username}`);

export const enqueueHotspotDelete = (
  routerId: string, username: string, tenantId: string | null
) => enqueueMikroTikOp('delete-hotspot-user', routerId, { username }, tenantId, `delete-hotspot:${routerId}:${username}`);

export const enqueueDisconnectSession = (
  routerId: string, sessionId: string, tenantId: string | null
) => enqueueMikroTikOp('disconnect-session', routerId, { sessionId }, tenantId, `disconnect:${routerId}:${sessionId}`);

// ── Job Status ────────────────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<{
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
  result?: unknown;
  error?: string;
}> {
  const job = await getMikroTikQueue().getJob(jobId);
  if (!job) return { status: 'unknown' };
  const state = await job.getState();
  if (state === 'completed') return { status: 'completed', result: job.returnvalue };
  if (state === 'failed')    return { status: 'failed',    error: job.failedReason };
  if (state === 'active')    return { status: 'active' };
  return { status: 'waiting' };
}
