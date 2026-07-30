import "dotenv/config";
import { env } from "@/lib/env";
import { Worker, Job } from "bullmq";
import { getRedisConnection, type RouterJobData } from "@/lib/queue";
import { getRouterAdapter } from "@/lib/routerAdapters";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";
import * as fs from "fs/promises";
import * as path from "path";

void env;

const QUEUE_NAME = "router-ops";
const BACKUP_DIR = process.env.ROUTER_BACKUP_DIR || path.join(process.cwd(), "backups");

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

async function handleBackupRouter(job: Job<RouterJobData>) {
    const { routerId, tenantId, vendor } = job.data;
    logger.info(`[BackupWorker] Processing backup for router ${routerId}`, { vendor });

    try {
        const adapter = await getRouterAdapter(routerId, tenantId);
        
        // Ensure backup directory exists
        await fs.mkdir(BACKUP_DIR, { recursive: true });

        // Backup via adapter
        const result = await adapter.backup();

        if (result.success && result.data) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `router_${routerId}_${timestamp}.backup`;
            const filepath = path.join(BACKUP_DIR, filename);

            // If it's binary data (buffer), write as buffer, otherwise as string
            if (Buffer.isBuffer(result.data)) {
                await fs.writeFile(filepath, result.data);
            } else {
                await fs.writeFile(filepath, String(result.data));
            }

            logger.info(`[BackupWorker] Backup saved to ${filepath}`, { routerId });
            await log(routerId, tenantId, "backup-router", "success", `Backup saved to ${filepath}`);
            return { success: true, filepath };
        } else {
            throw new Error(result.message || "Adapter returned no backup data");
        }
    } catch (error: any) {
        logger.error("[BackupWorker] Failed backup", { routerId, tenantId, error: error.message });
        await log(routerId, tenantId, "backup-router", "failed", error.message);
        throw error;
    }
}

export function startRouterBackupWorker() {
    logger.info("[BackupWorker] Starting Router Backup BullMQ worker...");

    const worker = new Worker<RouterJobData>(
        QUEUE_NAME,
        async (job) => {
            if (job.name === "backup-router") {
                return handleBackupRouter(job);
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 3,
        }
    );

    worker.on("completed", (job) => {
        if (job.name === "backup-router") {
            logger.debug(`[BackupWorker] Job ${job.id} completed successfully`);
        }
    });

    worker.on("failed", (job, err) => {
        if (job?.name === "backup-router") {
            logger.error(`[BackupWorker] Job ${job?.id} failed`, { error: err.message });
        }
    });

    return worker;
}

if (require.main === module) {
    startRouterBackupWorker();
}
