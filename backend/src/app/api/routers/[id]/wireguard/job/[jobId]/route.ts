/**
 * GET /api/routers/[id]/wireguard/job/[jobId]
 *
 * Poll the status of an async push-config BullMQ job.
 *
 * Returns:
 *   { status: "waiting"|"active"|"completed"|"failed"|"unknown", result?, error? }
 *
 * The frontend polls this endpoint every 3s after receiving a jobId from
 * POST /api/routers/[id]/wireguard { action: "push-config" }.
 * When status is "completed" or "failed", polling should stop.
 */

import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getRouterQueue } from "@/lib/queue";
import logger from "@/lib/logger";

export const maxDuration = 15;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; jobId: string }> }
) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const { id, jobId } = await params;

        // Verify the caller can access this router
        const db = getTenantClient(userPayload);
        const router = await db.router.findUnique({
            where: { id },
            select: { tenantId: true, name: true },
        });
        if (!router) return errorResponse("Router not found", 404);
        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        // Look up job status in BullMQ
        const queue = getRouterQueue();
        const job = await queue.getJob(jobId);

        if (!job) {
            // Job may have completed and been removed from the queue
            // Check the router log for a terminal entry
            const logEntry = await db.routerLog.findFirst({
                where: {
                    routerId: id,
                    action: { in: ["push_config", "wireguard_pushed", "wireguard_pushed_partial"] },
                },
                orderBy: { createdAt: "desc" },
            });

            if (logEntry) {
                return jsonResponse({
                    status: "completed",
                    result: {
                        success: logEntry.status === "success",
                        message: logEntry.details,
                    },
                    message: "Job completed (removed from queue). See router logs for details.",
                });
            }

            return jsonResponse({
                status: "unknown",
                message: "Job not found. It may have expired or never existed.",
            });
        }

        const state = await job.getState();

        if (state === "completed") {
            const result = job.returnvalue as Record<string, unknown> | undefined;
            return jsonResponse({
                status: "completed",
                result,
                message: (result?.message as string) ?? "Auto-Push completed successfully.",
                tunnelVerified: result?.tunnelVerified ?? false,
                success: result?.success ?? true,
                partialSuccess: result?.partialSuccess ?? false,
                stepsWithIssues: result?.stepsWithIssues ?? 0,
                stepDetails: result?.stepDetails,
            });
        }

        if (state === "failed") {
            return jsonResponse({
                status: "failed",
                error: job.failedReason ?? "Unknown error",
                message: `Auto-Push failed: ${job.failedReason ?? "Unknown error"}. Check router logs for details.`,
                success: false,
            });
        }

        if (state === "active") {
            return jsonResponse({
                status: "active",
                progress: job.progress ?? 0,
                message: "Auto-Push is running. Router is being provisioned...",
            });
        }

        // delayed, waiting, etc.
        return jsonResponse({
            status: "waiting",
            message: "Auto-Push job is queued and waiting for a worker.",
        });

    } catch (err: any) {
        logger.error("[job/status] Failed to get job status", { error: err.message });
        return errorResponse("Failed to retrieve job status", 500);
    }
}
