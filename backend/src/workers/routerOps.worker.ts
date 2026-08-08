/**
 * Router Operations Worker — BullMQ
 *
 * VENDOR-ADAPTER-011: Unified vendor-agnostic router operations worker.
 *
 * Replaces the MikroTik-specific mikrotik.worker.ts.
 * Now handles all vendors via getRouterAdapter() — the correct adapter
 * is selected automatically based on the router's vendor field.
 *
 * Changes from previous version:
 *   - Queue name: "mikrotik-ops" → "router-ops"
 *   - All handlers use RouterAdapter interface (no `as any` casts)
 *   - activateService / suspendService now properly typed
 *   - tenantId guard: undefined → null before passing to adapter
 *   - Per-operation audit logging with vendor + adapter version
 *   - New handlers: discover-router, health-check, sync-router, backup-router, reboot-router
 *
 * Backward compatibility:
 *   - Old "mikrotik-ops" queue jobs are drained by this worker too
 *     (see startLegacyMikrotikWorker below)
 */

import "dotenv/config";
import { env } from "@/lib/env";
import { Worker, Job } from "bullmq";
import { getRedisConnection, type RouterJobData } from "@/lib/queue";
import { getRouterAdapter } from "@/lib/routerAdapters";
import { getTenantClient } from "@/lib/tenantPrisma";
import { executePushConfig } from "@/lib/pushConfigExecutor";
import logger from "@/lib/logger";

void env;

const QUEUE_NAME = "router-ops";
const LEGACY_QUEUE_NAME = "mikrotik-ops";
const CONCURRENCY = 5;

// ── Log helper ────────────────────────────────────────────────────────────────

async function log(
    routerId: string,
    tenantId: string | null,
    action: string,
    status: "success" | "failed",
    details?: string
) {
    try {
        const db = getTenantClient(null);
        await db.routerLog.create({
            data: {
                routerId,
                tenantId,
                action,
                status,
                details: details?.slice(0, 500) ?? null,
            },
        });
    } catch { /* non-fatal */ }
}

// ── Job Handlers ──────────────────────────────────────────────────────────────

const handlers: Record<string, (data: RouterJobData) => Promise<unknown>> = {

    "create-pppoe-user": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.createPPPoE({
            name: payload.username as string,
            password: payload.password as string,
            service: "pppoe",
            profile: payload.profile as string,
            disabled: false,
            comment: "HQ-BILLING",
        });
        await log(routerId, tenantId ?? null, "create-pppoe-user", r.success ? "success" : "failed", `user: ${payload.username}`);
        return r;
    },

    "delete-pppoe-user": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.createPPPoE({ id: payload.username as string, delete: true });
        await log(routerId, tenantId ?? null, "delete-pppoe-user", r.success ? "success" : "failed", `user: ${payload.username}`);
        return r;
    },

    "update-pppoe-user": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.createPPPoE({
            id: payload.username as string,
            password: payload.password as string | undefined,
            profile: payload.profile as string | undefined,
            disabled: payload.disabled as boolean | undefined,
            update: true,
        });
        await log(routerId, tenantId ?? null, "update-pppoe-user", r.success ? "success" : "failed", `user: ${payload.username}`);
        return r;
    },

    "create-hotspot-user": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.createHotspot({
            name: payload.username as string,
            password: payload.password as string,
            profile: payload.profile as string,
            server: "all",
            disabled: false,
            comment: "HQ-BILLING",
        });
        await log(routerId, tenantId ?? null, "create-hotspot-user", r.success ? "success" : "failed", `user: ${payload.username}`);
        return r;
    },

    "delete-hotspot-user": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.createHotspot({ id: payload.username as string, delete: true });
        await log(routerId, tenantId ?? null, "delete-hotspot-user", r.success ? "success" : "failed", `user: ${payload.username}`);
        return r;
    },

    "activate-service": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const username = payload.username as string;
        const password = payload.password as string;
        const profileName = payload.profileName as string;
        const serviceType = payload.serviceType as "pppoe" | "hotspot";
        const expiresAt = payload.expiresAt ? new Date(payload.expiresAt as string) : undefined;

        let r: { success: boolean; message: string; data?: any };

        // Use typed activateService if the adapter supports it (MikroTik)
        if (typeof adapter.activateService === "function") {
            r = await adapter.activateService(username, password, profileName, serviceType, expiresAt);
        } else if (serviceType === "pppoe") {
            r = await adapter.createPPPoE({ name: username, password, profile: profileName, disabled: false });
        } else {
            r = await adapter.createHotspot({ name: username, password, profile: profileName, disabled: false });
        }

        await log(routerId, tenantId ?? null, "activate-service", r.success ? "success" : "failed",
            `user: ${username}, service: ${serviceType}`);
        return r;
    },

    "suspend-service": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const username = payload.username as string;
        const serviceType = payload.serviceType as "pppoe" | "hotspot";

        let r: { success: boolean; message: string; data?: any };

        if (typeof adapter.suspendService === "function") {
            r = await adapter.suspendService(username, serviceType);
        } else {
            // Fallback: disable via createPPPoE/createHotspot with disabled:true
            if (serviceType === "pppoe") {
                r = await adapter.createPPPoE({ id: username, disabled: true, update: true });
            } else {
                r = await adapter.createHotspot({ id: username, disabled: true, update: true });
            }
        }

        await log(routerId, tenantId ?? null, "suspend-service", r.success ? "success" : "failed",
            `user: ${username}, service: ${serviceType}`);
        return r;
    },

    "disconnect-session": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const sessionId = payload.sessionId as string;
        if (typeof adapter.disconnectSession !== "function") {
            return { success: false, message: `${adapter.name} does not support session disconnect` };
        }
        const r = await adapter.disconnectSession(sessionId);
        await log(routerId, tenantId ?? null, "disconnect-session", r.success ? "success" : "failed", `session: ${sessionId}`);
        return r;
    },

    "sync-subscription": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.createPPPoE({
            id: payload.username as string,
            profile: payload.profile as string | undefined,
            disabled: payload.disabled as boolean | undefined,
            update: true,
        });
        await log(routerId, tenantId ?? null, "sync-subscription", r.success ? "success" : "failed", `user: ${payload.username}`);
        return r;
    },

    "discover-router": async ({ routerId, tenantId }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const capabilities = await adapter.discoverCapabilities();
        await log(routerId, tenantId ?? null, "discover-router", "success",
            `vendor: ${capabilities.vendor}, firmware: ${capabilities.firmwareVersion}`);
        return { success: true, capabilities };
    },

    "health-check": async ({ routerId, tenantId }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.healthCheck();
        await log(routerId, tenantId ?? null, "health-check", r.success ? "success" : "failed",
            r.success ? "healthy" : r.message);
        return r;
    },

    "sync-router": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.monitor();
        await log(routerId, tenantId ?? null, "sync-router", r.success ? "success" : "failed",
            r.success ? "synced" : r.message);
        return r;
    },

    "backup-router": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.backup({ name: payload.name as string });
        await log(routerId, tenantId ?? null, "backup-router", r.success ? "success" : "failed",
            r.success ? "backup created" : r.message);
        return r;
    },

    "reboot-router": async ({ routerId, tenantId, payload }) => {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const r = await adapter.reboot(payload);
        await log(routerId, tenantId ?? null, "reboot-router", r.success ? "success" : "failed",
            r.success ? "rebooted" : r.message);
        return r;
    },

    // ── Push-Config: async MikroTik provisioning ─────────────────────────────
    // Runs the full WireGuard + Hotspot + PPPoE + RADIUS + Firewall provisioning
    // pipeline asynchronously. Eliminates 504 gateway timeouts that occurred
    // when the synchronous HTTP handler exceeded nginx's proxy_read_timeout.
    "push-config": async ({ routerId, tenantId, payload }) => {
        logger.info(`[RouterWorker] Starting push-config for router ${routerId}`);
        const result = await executePushConfig(
            routerId,
            tenantId ?? null,
            {
                lanPorts:       Array.isArray(payload.lanPorts) ? payload.lanPorts : [],
                serverEndpoint: payload.serverEndpoint as string | undefined,
                serverPort:     payload.serverPort as number | undefined,
            }
        );
        await log(
            routerId,
            tenantId ?? null,
            "push-config",
            result.success ? "success" : "failed",
            result.message.slice(0, 500)
        );
        return result;
    },
};

// ── Worker Factory ────────────────────────────────────────────────────────────

function createWorker(queueName: string): Worker<RouterJobData> {
    const worker = new Worker<RouterJobData>(
        queueName,
        async (job: Job<RouterJobData>) => {
            const { name, routerId, idempotencyKey, tenantId, vendor } = job.data;
            logger.info(`[RouterWorker] start: ${name}`, {
                jobId: job.id,
                routerId,
                vendor: vendor ?? "unknown",
                idempotencyKey,
                queue: queueName,
            });

            const handler = handlers[name];
            if (!handler) throw new Error(`Unknown job type: ${name}`);

            try {
                const result = await handler(job.data);
                logger.info(`[RouterWorker] done: ${name}`, {
                    jobId: job.id,
                    routerId,
                    vendor: vendor ?? "unknown",
                });
                return result;
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`[RouterWorker] failed: ${name}`, {
                    jobId: job.id,
                    routerId,
                    vendor: vendor ?? "unknown",
                    error: msg,
                    attempt: job.attemptsMade,
                });
                await log(routerId, tenantId ?? null, name, "failed", msg);
                throw err;
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: CONCURRENCY,
            stalledInterval: 60_000,
        }
    );

    worker.on("completed", (job) =>
        logger.info(`[RouterWorker] completed: ${job.data.name}`, { jobId: job.id, queue: queueName })
    );
    worker.on("failed", (job, err) =>
        logger.error("[RouterWorker] permanently failed", {
            jobId: job?.id,
            name: job?.data?.name,
            vendor: job?.data?.vendor,
            error: err.message,
        })
    );
    worker.on("error", (err) =>
        logger.error("[RouterWorker] worker error", { error: err.message, queue: queueName })
    );

    logger.info(`[RouterWorker] started — queue: ${queueName}, concurrency: ${CONCURRENCY}`);
    return worker;
}

export function startRouterOpsWorker(): Worker<RouterJobData> {
    return createWorker(QUEUE_NAME);
}

/** @deprecated Use startRouterOpsWorker() — kept for backward compat with PM2 configs */
export function startMikroTikWorker(): Worker<RouterJobData> {
    return createWorker(LEGACY_QUEUE_NAME);
}

// ── Entry Point ───────────────────────────────────────────────────────────────

if (require.main === module) {
    // Start both queues — drains existing mikrotik-ops jobs + new router-ops jobs
    const routerWorker = startRouterOpsWorker();
    const legacyWorker = startMikroTikWorker();

    const shutdown = async () => {
        logger.info("[RouterWorker] shutting down...");
        await Promise.all([routerWorker.close(), legacyWorker.close()]);
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
