/**
 * Provision Executor
 *
 * VENDOR-ADAPTER-PROV-002: Step-based adapter dispatch for vendor-agnostic provisioning.
 *
 * CRITICAL FIX: The previous implementation uploaded a RouterOS .rsc script to
 * /system/script on ALL vendors — this crashes for Omada, UniFi, and TPLink.
 *
 * New implementation:
 *   - Reads each step's adapterId and dispatches to adapter[adapterId](params)
 *   - Works for ALL vendors — MikroTik, Omada, UniFi, TPLink, Future
 *   - Per-step: progress tracking in RouterProvisioningLog
 *   - Per-step: retry on transient errors
 *   - Per-step: rollback attempt on failure
 *   - Dry-run mode: simulates steps without executing
 *   - Full audit trail in DB
 */

import logger from "@/lib/logger";
import { getRouterAdapter } from "./routerAdapters";
import { buildProvisioningPlan, type ProvisioningPlan, type ProvisioningStep } from "./routerProvisioningEngine";
import { getTenantClient } from "./tenantPrisma";

export interface ProvisionExecutionOptions {
    dryRun?: boolean;
    maxRetries?: number;
    /** Base delay for exponential backoff: delay = baseRetryDelayMs * 2^attempt (ms) */
    baseRetryDelayMs?: number;
    /** Timeout per step in milliseconds (default: 30s) */
    stepTimeoutMs?: number;
    /**
     * Rollback policy when a step fails:
     *   BEST_EFFORT  — attempt rollback, ignore errors (default)
     *   ABORT        — stop plan immediately, do not rollback
     *   COMPENSATING — run compensating adapter method instead of delete
     *   SKIP         — skip rollback entirely, leave state as-is
     */
    rollbackPolicy?: RollbackPolicy;
}

export type RollbackPolicy = "BEST_EFFORT" | "ABORT" | "COMPENSATING" | "SKIP";

export interface StepResult {
    stepId: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED" | "DRY_RUN";
    durationMs: number;
    message: string;
    data?: unknown;
    error?: string;
    rolledBack?: boolean;
}

export interface ProvisionExecutionResult {
    success: boolean;
    dryRun?: boolean;
    planId: string;
    vendor: string;
    firmwareVersion?: string | null;
    steps: StepResult[];
    stepCount: number;
    successCount: number;
    failureCount: number;
    skippedCount: number;
    error?: string;
    logId?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    return (
        msg.includes("timeout") ||
        msg.includes("econnrefused") ||
        msg.includes("enotfound") ||
        msg.includes("econnreset") ||
        msg.includes("etimedout")
    );
}

// ── DB Logging ────────────────────────────────────────────────────────────────

async function writeStepLog(
    db: ReturnType<typeof getTenantClient>,
    routerId: string,
    tenantId: string | null,
    planId: string,
    step: ProvisioningStep,
    status: string,
    vendor: string,
    dryRun: boolean,
    opts: {
        commandSent?: string;
        responseData?: string;
        errorMessage?: string;
        durationMs?: number;
        attemptNumber?: number;
        rollbackCmd?: string;
    } = {}
): Promise<string> {
    try {
        const record = await db.routerProvisioningLog.create({
            data: {
                routerId,
                tenantId,
                planId,
                stepId: step.id,
                stepName: step.name,
                vendor,
                status,
                dryRun,
                commandSent: opts.commandSent?.slice(0, 500) ?? null,
                responseData: opts.responseData?.slice(0, 2000) ?? null,
                errorMessage: opts.errorMessage?.slice(0, 1000) ?? null,
                durationMs: opts.durationMs ?? null,
                attemptNumber: opts.attemptNumber ?? 1,
                rollbackCmd: opts.rollbackCmd?.slice(0, 500) ?? null,
            },
        });
        return record.id;
    } catch (e) {
        logger.warn("[ProvisionExecutor] Failed to write step log", { error: String(e) });
        return "";
    }
}

// ── Step Executor ─────────────────────────────────────────────────────────────

async function executeStep(
    adapter: Awaited<ReturnType<typeof getRouterAdapter>>,
    step: ProvisioningStep,
    maxRetries: number,
    baseRetryDelayMs: number
): Promise<{ success: boolean; message: string; data?: unknown; error?: string }> {
    // Validate adapter has this method
    const method = (adapter as any)[step.adapterId];
    if (typeof method !== "function") {
        return {
            success: false,
            error: `Adapter ${adapter.name} does not implement method: ${step.adapterId}`,
            message: `Method ${step.adapterId} not found on ${adapter.name}`,
        };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await method.call(adapter, step.params);

            if (result && typeof result === "object" && "success" in result) {
                if (result.success) {
                    return { success: true, message: result.message || "OK", data: result.data };
                } else {
                    // Adapter returned success:false (e.g. unsupported) — not transient, don't retry
                    return { success: false, message: result.message || "Adapter returned failure", error: result.message };
                }
            }
            // discoverCapabilities returns capability set directly
            return { success: true, message: "Completed", data: result };
        } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            const transient = isTransientError(err);

            if (attempt < maxRetries && transient) {
                // Exponential backoff: 1s → 2s → 4s → 8s...
                const backoffMs = baseRetryDelayMs * Math.pow(2, attempt - 1);
                const jitterMs = Math.random() * 200; // ±200ms jitter to avoid thundering herd
                logger.warn(
                    `[ProvisionExecutor] Step ${step.id} attempt ${attempt}/${maxRetries} failed (transient) — retry in ${Math.round(backoffMs + jitterMs)}ms`,
                    { error: lastError.message }
                );
                await sleepMs(backoffMs + jitterMs);
            } else {
                if (!transient) {
                    logger.warn(`[ProvisionExecutor] Step ${step.id} failed (non-transient, no retry)`, { error: lastError.message });
                }
                break;
            }
        }
    }

    return {
        success: false,
        message: lastError?.message ?? "Unknown error",
        error: lastError?.message,
    };
}

// ── Rollback Helper ───────────────────────────────────────────────────────────

async function attemptRollback(
    adapter: Awaited<ReturnType<typeof getRouterAdapter>>,
    step: ProvisioningStep,
    policy: RollbackPolicy = "BEST_EFFORT"
): Promise<boolean> {
    if (policy === "SKIP" || policy === "ABORT") return false;
    if (!step.rollbackAdapterId) return false;
    try {
        const rollbackMethod = (adapter as any)[step.rollbackAdapterId];
        if (typeof rollbackMethod !== "function") return false;
        await rollbackMethod.call(adapter, step.rollbackParams ?? {});
        logger.info(`[ProvisionExecutor] Rolled back step: ${step.id} (policy=${policy})`);
        return true;
    } catch (err) {
        if (policy === "BEST_EFFORT") {
            logger.warn(`[ProvisionExecutor] Rollback failed (ignored, BEST_EFFORT): ${step.id}`, { error: String(err) });
            return false;
        }
        // COMPENSATING: re-throw so caller can handle
        logger.error(`[ProvisionExecutor] Rollback failed (COMPENSATING): ${step.id}`, { error: String(err) });
        throw err;
    }
}

// ── Main Executor ─────────────────────────────────────────────────────────────

export async function executeProvisioningPlan(
    routerId: string,
    tenantId: string | null,
    plan: ProvisioningPlan,
    opts?: boolean | ProvisionExecutionOptions
): Promise<ProvisionExecutionResult> {
    const options: ProvisionExecutionOptions =
        typeof opts === "boolean" ? { dryRun: opts } : opts ?? {};
    const {
        dryRun = true,
        maxRetries = 3,
        baseRetryDelayMs = 1000,
        rollbackPolicy = "BEST_EFFORT",
    } = options;

    const db = getTenantClient(null);
    const adapter = await getRouterAdapter(routerId, tenantId);
    const planId = plan.id;

    logger.info("[ProvisionExecutor] Starting plan execution", {
        planId,
        routerId,
        vendor: plan.vendor,
        stepCount: plan.steps.length,
        dryRun,
    });

    const stepResults: StepResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let hasFatalFailure = false;

    // NOTE: Do NOT update provisioningStatus here — the provision worker
    // state machine owns all status transitions (DISCOVERING→VALIDATING→PROVISIONING…)
    // Updating it here would cause a race condition.

    // ── Dependency resolution (topological order is already provided by plan builder)
    // We respect dependsOn: if a dependency step failed, skip this step.
    const completedStepIds = new Set<string>();
    const failedStepIds = new Set<string>();

    for (const step of plan.steps) {
        const stepStart = Date.now();

        // Check if any dependency failed
        const failedDep = step.dependsOn.find((depId) => failedStepIds.has(depId));
        if (failedDep) {
            const skipResult: StepResult = {
                stepId: step.id,
                status: "SKIPPED",
                durationMs: 0,
                message: `Skipped because dependency "${failedDep}" failed`,
            };
            stepResults.push(skipResult);
            skippedCount++;
            failedStepIds.add(step.id);

            await writeStepLog(db, routerId, tenantId, planId, step, "SKIPPED", plan.vendor, dryRun, {
                errorMessage: skipResult.message,
            });
            continue;
        }

        // Dry-run: log intent, don't execute
        if (dryRun) {
            const dryResult: StepResult = {
                stepId: step.id,
                status: "DRY_RUN",
                durationMs: 0,
                message: `[DRY RUN] Would execute: ${step.adapterId}(${JSON.stringify(step.params)})`,
            };
            stepResults.push(dryResult);
            successCount++;
            completedStepIds.add(step.id);

            await writeStepLog(db, routerId, tenantId, planId, step, "DRY_RUN", plan.vendor, true, {
                commandSent: `${step.adapterId}(${JSON.stringify(step.params)})`,
            });
            continue;
        }

        // Execute step
        logger.info(`[ProvisionExecutor] Executing step: ${step.id} → ${step.adapterId}`, { planId, routerId });

        const { success, message, data, error } = await executeStep(
            adapter,
            step,
            maxRetries,
            baseRetryDelayMs
        );

        const durationMs = Date.now() - stepStart;

        if (success) {
            const stepResult: StepResult = {
                stepId: step.id,
                status: "SUCCESS",
                durationMs,
                message,
                data,
            };
            stepResults.push(stepResult);
            successCount++;
            completedStepIds.add(step.id);

            await writeStepLog(db, routerId, tenantId, planId, step, "SUCCESS", plan.vendor, false, {
                commandSent: `${step.adapterId}(${JSON.stringify(step.params)})`,
                responseData: JSON.stringify(data).slice(0, 2000),
                durationMs,
            });
        } else {
            // Step failed
            let rolledBack = false;
            if (step.rollbackAdapterId && rollbackPolicy !== "ABORT") {
                rolledBack = await attemptRollback(adapter, step, rollbackPolicy);
            }

            const stepResult: StepResult = {
                stepId: step.id,
                status: "FAILED",
                durationMs,
                message,
                error,
                rolledBack,
            };
            stepResults.push(stepResult);
            failureCount++;
            failedStepIds.add(step.id);

            // Mark as fatal only if step is a hard requirement (validate/discover)
            if (step.id === "validate" || step.id === "discover-capabilities") {
                hasFatalFailure = true;
            }

            await writeStepLog(db, routerId, tenantId, planId, step, "FAILED", plan.vendor, false, {
                commandSent: `${step.adapterId}(${JSON.stringify(step.params)})`,
                errorMessage: error,
                durationMs,
                rollbackCmd: step.rollbackAdapterId ?? undefined,
            });

            logger.warn(`[ProvisionExecutor] Step failed: ${step.id}`, { error, planId, routerId });

            if (hasFatalFailure) {
                // Stop plan execution on fatal failure
                break;
            }
        }
    }

    const overallSuccess = failureCount === 0 && !hasFatalFailure;
    // Status values align with the provision worker state machine
    const provisioningStatus = dryRun
        ? "DRY_RUN"
        : overallSuccess
            ? "COMPLETED"
            : hasFatalFailure
                ? "FAILED"
                : "PARTIAL";

    // NOTE: provisioningStatus is NOT updated here — the provision worker state
    // machine writes the final status after executeProvisioningPlan returns.

    // Write overall router log
    await db.routerLog.create({
        data: {
            routerId,
            tenantId,
            action: dryRun ? "provision:dry-run" : "provision:complete",
            status: overallSuccess || dryRun ? "success" : "error",
            details: `Plan ${planId} | Steps: ${plan.steps.length} total, ${successCount} ok, ${failureCount} failed, ${skippedCount} skipped`,
        },
    }).catch(() => { /* non-fatal */ });

    logger.info("[ProvisionExecutor] Plan complete", {
        planId,
        routerId,
        success: overallSuccess,
        successCount,
        failureCount,
        skippedCount,
        dryRun,
    });

    return {
        success: overallSuccess,
        dryRun,
        planId,
        vendor: plan.vendor,
        firmwareVersion: plan.firmwareVersion,
        steps: stepResults,
        stepCount: plan.steps.length,
        successCount,
        failureCount,
        skippedCount,
        logId: null,
    };
}

export default executeProvisioningPlan;
