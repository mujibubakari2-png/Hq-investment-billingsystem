import { Queue } from "bullmq";
import { getRedisConnection } from "./redis";
import logger from "./logger";
import { RouterVendor } from "./routerAdapters";
import { getTenantClient } from "./tenantPrisma";

export type RouterJobName =
    | "activate-service"
    | "suspend-service"
    | "health-check"
    | "sync-router"
    | "backup-router"
    | "reboot-router"
    | "provision-router"
    | "discover-router"
    | "discovery-sweep";   // BullMQ repeatable cron sweep job


export type RouterJobData = {
    name: RouterJobName;
    routerId: string;
    tenantId: string | null;
    vendor?: RouterVendor;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
};

/**
 * Job Priority Constants (BullMQ: lower number = higher priority)
 *
 * ENTERPRISE-010: Priority queue — emergency ops run first.
 *
 *   1  EMERGENCY_REBOOT   router is down, restore immediately
 *   10 CRITICAL           security or billing-critical ops
 *   50 PROVISION          initial/re-provisioning
 *   70 HEALTH_CHECK       periodic health poll
 *   100 SERVICE_OP        activate / suspend user service
 *   150 SYNC              background sync
 *   200 DISCOVERY         capability discovery sweep
 */
export const JOB_PRIORITY = {
    EMERGENCY_REBOOT: 1,
    CRITICAL:         10,
    PROVISION:        50,
    HEALTH_CHECK:     70,
    SERVICE_OP:       100,
    SYNC:             150,
    DISCOVERY:        200,
} as const;

// ENTERPRISE-014: Region-aware queue names
// A worker binds to a specific region via WORKER_REGION env var.
// E.g., if WORKER_REGION=AFRICA, it listens on "router-ops:africa".
const workerRegion = process.env.WORKER_REGION ? `:${process.env.WORKER_REGION.toLowerCase()}` : '';
const QUEUE_NAME = `router-ops${workerRegion}`;
const DISCOVERY_QUEUE_NAME = `router-discovery${workerRegion}`;

let _queue: Queue<RouterJobData> | null = null;
let _discoveryQueue: Queue<any> | null = null;

/** Get a region-specific queue instance based on the target router's region */
export function getRegionQueue(region?: string | null): Queue<RouterJobData> {
    const r = region ? `:${region.toLowerCase()}` : '';
    return new Queue(`router-ops${r}`, { connection: getRedisConnection() });
}

export function getRouterQueue(): Queue<RouterJobData> {
    if (!_queue) {
        _queue = new Queue<RouterJobData>(QUEUE_NAME, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 4,
                backoff: { type: "exponential", delay: 2000 },
                removeOnComplete: { age: 24 * 3600 },
                removeOnFail: { age: 7 * 24 * 3600 },
            },
        });
        _queue.on("error", (err) => {
            logger.error("[Router Queue] error", { error: err.message });
        });
    }
    return _queue;
}

export function getDiscoveryQueue(): Queue<RouterJobData> {
    if (!_discoveryQueue) {
        _discoveryQueue = new Queue<RouterJobData>(DISCOVERY_QUEUE_NAME, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: { age: 6 * 3600 },
                removeOnFail: { age: 24 * 3600 },
            },
        });
        _discoveryQueue.on("error", (err) => {
            logger.error("[Discovery Queue] error", { error: err.message });
        });
    }
    return _discoveryQueue;
}

export async function closeRouterQueue(): Promise<void> {
    if (_queue) {
        try { await _queue.close(); } catch { /* ignore */ } finally { _queue = null; }
    }
    if (_discoveryQueue) {
        try { await _discoveryQueue.close(); } catch { /* ignore */ } finally { _discoveryQueue = null; }
    }
}

export type EnqueueOptions = {
    idempotencyKey?: string;
    priority?: number;
    delay?: number;
    attempts?: number;
};

export async function enqueueRouterOp(
    action: RouterJobName,
    routerId: string,
    tenantId: string | null,
    payload: any,
    opts?: { idempotencyKey?: string; priority?: number },
    vendor?: RouterVendor
): Promise<string> {
    const db = getTenantClient(tenantId);
    const routerRecord = await db.router.findUnique({
        where: { id: routerId },
        select: { vendor: true, region: true }
    });

    const finalVendor = vendor ?? (routerRecord?.vendor as RouterVendor) ?? "mikrotik";
    const region = routerRecord?.region; // Can be AFRICA, EUROPE etc.

    const jobId = opts?.idempotencyKey ?? crypto.randomUUID();
    const data: RouterJobData = {
        name: action,
        routerId,
        tenantId: tenantId ?? null,
        payload,
        vendor: finalVendor,
        idempotencyKey: jobId
    };

    // Get the specific queue for this router's region
    const targetQueue = getRegionQueue(region);

    logger.info(`[Queue] Enqueueing ${action} for router ${routerId} to queue ${targetQueue.name}`, { jobId, priority: opts?.priority });
    await targetQueue.add(action, data, {
        jobId,
        removeOnComplete: 100,
        removeOnFail: 500,
        priority: opts?.priority,
    });

    return jobId;
}

export async function enqueueActivateService(
    routerId: string,
    tenantId: string | null,
    username: string,
    password?: string,
    profileName?: string,
    serviceType: "pppoe" | "hotspot" = "pppoe",
    expiresAt?: Date,
    vendor?: RouterVendor
): Promise<string> {
    return enqueueRouterOp(
        "activate-service",
        routerId,
        tenantId,
        { username, password, profileName, serviceType, expiresAt },
        { idempotencyKey: `activate:${routerId}:${username}:${serviceType}`, priority: JOB_PRIORITY.SERVICE_OP },
        vendor
    );
}

export async function enqueueSuspendService(
    routerId: string,
    tenantId: string | null,
    username: string,
    serviceType: "pppoe" | "hotspot",
    vendor?: RouterVendor
): Promise<string> {
    return enqueueRouterOp(
        "suspend-service",
        routerId,
        tenantId,
        { username, serviceType },
        { idempotencyKey: `suspend:${routerId}:${username}:${serviceType}`, priority: JOB_PRIORITY.SERVICE_OP },
        vendor
    );
}

export async function enqueueDiscoverRouter(
    routerId: string,
    tenantId: string | null,
    vendor?: RouterVendor
): Promise<string> {
    // Route to the dedicated discovery queue (consumed by routerDiscovery.worker.ts)
    const key = `discover:${routerId}`;
    const queue = getDiscoveryQueue();
    const job = await queue.add(
        "discover-router",
        { name: "discover-router" as any, routerId, tenantId, vendor, payload: {}, idempotencyKey: key },
        {
            jobId: key,
            attempts: 2,
        }
    );
    logger.info(`[Discovery Queue] enqueued discover-router`, { jobId: job.id, routerId, vendor });
    return job.id ?? key;
}

export async function enqueueHealthCheck(
    routerId: string,
    tenantId: string | null,
    vendor?: RouterVendor
): Promise<string> {
    return enqueueRouterOp(
        "health-check",
        routerId,
        tenantId,
        {},
        { idempotencyKey: `health:${routerId}`, priority: JOB_PRIORITY.HEALTH_CHECK },
        vendor
    );
}

export async function enqueueEmergencyReboot(
    routerId: string,
    tenantId: string | null,
    reason: string,
    vendor?: RouterVendor
): Promise<string> {
    return enqueueRouterOp(
        "reboot-router",
        routerId,
        tenantId,
        { reason, emergency: true },
        // No idempotency key — every emergency reboot should run
        { priority: JOB_PRIORITY.EMERGENCY_REBOOT },
        vendor
    );
}

export async function enqueueProvisionRouter(
    routerId: string,
    tenantId: string | null,
    vendor?: RouterVendor
): Promise<string> {
    return enqueueRouterOp(
        "provision-router",
        routerId,
        tenantId,
        {},
        { idempotencyKey: `provision:${routerId}`, priority: JOB_PRIORITY.PROVISION },
        vendor
    );
}

export async function getJobStatus(jobId: string): Promise<{
    status: "waiting" | "active" | "completed" | "failed" | "unknown";
    result?: unknown;
    error?: string;
}> {
    const job = await getRouterQueue().getJob(jobId);
    if (!job) return { status: "unknown" };
    const state = await job.getState();
    if (state === "completed") return { status: "completed", result: job.returnvalue };
    if (state === "failed") return { status: "failed", error: job.failedReason };
    if (state === "active") return { status: "active" };
    return { status: "waiting" };
}

export { getRedisConnection } from "./redis";
export const getMikroTikQueue = getRouterQueue as any;
export const closeMikroTikQueue = closeRouterQueue as any;
