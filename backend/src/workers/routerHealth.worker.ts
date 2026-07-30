import "dotenv/config";
import { env } from "@/lib/env";
import { Worker, Job } from "bullmq";
import { getRedisConnection, type RouterJobData } from "@/lib/queue";
import { getRouterAdapter } from "@/lib/routerAdapters";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";

void env;

const QUEUE_NAME = "router-ops";

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

async function handleHealthCheck(job: Job<RouterJobData>) {
    const { routerId, tenantId, vendor } = job.data;
    logger.info(`[HealthWorker] Processing health check for router ${routerId}`, { vendor });

    try {
        const adapter = await getRouterAdapter(routerId, tenantId);
        const result = await adapter.healthCheck();

        const db = getTenantClient(null);
        await db.router.update({
            where: { id: routerId },
            data: { healthStatus: result.success ? "ONLINE" : "OFFLINE" },
        });

        await log(routerId, tenantId, "health-check", result.success ? "success" : "failed", result.message);
        
        return result;
    } catch (error: any) {
        logger.error("[HealthWorker] Failed health check", { routerId, tenantId, error: error.message });
        
        const db = getTenantClient(null);
        await db.router.update({
            where: { id: routerId },
            data: { healthStatus: "OFFLINE" },
        });
        
        await log(routerId, tenantId, "health-check", "failed", error.message);
        throw error;
    }
}

export function startRouterHealthWorker() {
    logger.info("[HealthWorker] Starting Router Health BullMQ worker...");

    const worker = new Worker<RouterJobData>(
        QUEUE_NAME,
        async (job) => {
            if (job.name === "health-check") {
                return handleHealthCheck(job);
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 5,
        }
    );

    worker.on("completed", (job) => {
        if (job.name === "health-check") {
            logger.debug(`[HealthWorker] Job ${job.id} completed successfully`);
        }
    });

    worker.on("failed", (job, err) => {
        if (job?.name === "health-check") {
            logger.error(`[HealthWorker] Job ${job?.id} failed`, { error: err.message });
        }
    });

    return worker;
}

if (require.main === module) {
    startRouterHealthWorker();
}

