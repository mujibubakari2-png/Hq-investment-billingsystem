/**
 * RADIUS User Synchronization Queue — BullMQ
 *
 * RAD-Q-001: Moves all RADIUS write operations into an async job queue.
 * API routes enqueue a job and return 202 Accepted immediately.
 * A dedicated worker process executes the job with retries + backoff.
 *
 * This prevents slow RADIUS servers from blocking API request threads
 * and matches the architecture diagram: Event Queue → Radius Worker
 */

import { Queue, Job } from 'bullmq';
import logger from '@/lib/logger';
import { getRedisConnection } from '@/lib/redis';

// ── Job Types ─────────────────────────────────────────────────────────────────

export type RadiusJobName =
  | 'sync-user'
  | 'suspend-user'
  | 'delete-user';

export interface RadiusUserSyncParams {
  username: string;
  password?: string;
  tenantId: string | null;
  fullName?: string;
  expiresAt?: Date;
  status?: string;
  rateLimit?: string;
  profileName?: string;
  simultaneousUse?: number;
}

export interface RadiusJobData {
  name: RadiusJobName;
  idempotencyKey: string;
  tenantId: string | null;
  params: RadiusUserSyncParams | { username: string; tenantId: string | null };
}

// ── Queue Singleton ───────────────────────────────────────────────────────────

const QUEUE_NAME = 'radius-sync';
let _queue: Queue<RadiusJobData> | null = null;

export function getRadiusQueue(): Queue<RadiusJobData> {
  if (!_queue) {
    _queue = new Queue<RadiusJobData>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });
  }
  return _queue;
}

// ── Enqueue Operations ────────────────────────────────────────────────────────

/**
 * Queue a RADIUS user sync operation.
 * Returns a job ID for optional polling.
 */
export async function enqueueRadiusSyncUser(
  params: RadiusUserSyncParams,
  idempotencyKey?: string
): Promise<string> {
  const queue = getRadiusQueue();
  const key = idempotencyKey || `${params.username}-${Date.now()}`;

  const job = await queue.add(
    'sync-user',
    {
      name: 'sync-user',
      idempotencyKey: key,
      tenantId: params.tenantId,
      params,
    },
    {
      jobId: key,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  logger.info('[RadiusQueue] Enqueued sync-user', {
    jobId: job.id,
    username: params.username,
    tenantId: params.tenantId,
  });

  return job.id || '';
}

/**
 * Queue a RADIUS user suspension.
 */
export async function enqueueRadiusSuspendUser(
  username: string,
  tenantId: string | null,
  idempotencyKey?: string
): Promise<string> {
  const queue = getRadiusQueue();
  const key = idempotencyKey || `suspend-${username}-${Date.now()}`;

  const job = await queue.add(
    'suspend-user',
    {
      name: 'suspend-user',
      idempotencyKey: key,
      tenantId,
      params: { username, tenantId },
    },
    {
      jobId: key,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  logger.info('[RadiusQueue] Enqueued suspend-user', {
    jobId: job.id,
    username,
    tenantId,
  });

  return job.id || '';
}

/**
 * Queue a RADIUS user deletion.
 */
export async function enqueueRadiusDeleteUser(
  username: string,
  tenantId: string | null,
  idempotencyKey?: string
): Promise<string> {
  const queue = getRadiusQueue();
  const key = idempotencyKey || `delete-${username}-${Date.now()}`;

  const job = await queue.add(
    'delete-user',
    {
      name: 'delete-user',
      idempotencyKey: key,
      tenantId,
      params: { username, tenantId },
    },
    {
      jobId: key,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  logger.info('[RadiusQueue] Enqueued delete-user', {
    jobId: job.id,
    username,
    tenantId,
  });

  return job.id || '';
}

/**
 * Wait for a specific job to complete.
 * Useful for critical paths that need immediate result.
 * Throws on job failure.
 */
export async function waitForRadiusJob(jobId: string, timeoutMs: number = 30000): Promise<any> {
  const queue = getRadiusQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`RADIUS job not found: ${jobId}`);
  }

  // Poll for job completion with timeout
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const state = await job.getState();
    if (state === 'completed') {
      return job.returnvalue;
    }
    if (state === 'failed') {
      throw new Error(`RADIUS job failed: ${job.failedReason || 'Unknown reason'}`);
    }
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`RADIUS job timeout: ${jobId}`);
}
