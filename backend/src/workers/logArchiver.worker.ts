/**
 * Log Archiver Worker
 *
 * ENTERPRISE-011: DB Optimization — Log retention & pruning.
 * Periodically deletes old RouterLog and RouterProvisioningLog entries.
 * In a real carrier-grade deployment, this could export to S3 before deletion.
 */

import "dotenv/config";
import { env } from "@/lib/env";
import { Worker, Job } from "bullmq";
import { getRedisConnection } from "@/lib/queue";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";

const QUEUE_NAME = "log-archiver";
const RETENTION_DAYS = 30; // Keep logs for 30 days

export const logArchiverWorker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
        logger.info(`[LogArchiver] Starting log archival sweep...`);
        const db = getTenantClient(null);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        // Delete RouterLog older than 30 days
        const deletedRouterLogs = await db.routerLog.deleteMany({
            where: { createdAt: { lt: cutoffDate } }
        });

        // Delete RouterProvisioningLog older than 30 days
        const deletedProvisionLogs = await db.routerProvisioningLog.deleteMany({
            where: { startedAt: { lt: cutoffDate } }
        });

        logger.info(`[LogArchiver] Sweep completed`, {
            routerLogsDeleted: deletedRouterLogs.count,
            provisioningLogsDeleted: deletedProvisionLogs.count,
            cutoffDate: cutoffDate.toISOString()
        });
    },
    {
        connection: getRedisConnection(),
        concurrency: 1,
    }
);

logArchiverWorker.on("failed", (job, err) => {
    logger.error(`[LogArchiver] Failed job ${job?.id}: ${err.message}`);
});
