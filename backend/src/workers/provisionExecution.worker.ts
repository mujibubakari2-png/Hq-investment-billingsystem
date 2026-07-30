/**
 * Provision Execution Worker Helper
 *
 * VENDOR-ADAPTER-PROV-004: Thin wrapper that ties the provisioning engine to the executor.
 *
 * Updated to use the new step-based ProvisioningPlan from routerProvisioningEngine.ts.
 * No longer imports generateScriptFromPlan (removed — replaced by adapter dispatch).
 */

import { getRouterAdapter } from "@/lib/routerAdapters";
import { buildProvisioningPlan } from "@/lib/routerProvisioningEngine";
import logger from "@/lib/logger";
import { getTenantClient } from "@/lib/tenantPrisma";
import executeProvisioningPlan from "@/lib/provisionExecutor";

export async function runProvisionExecutionWorker(
    routerId: string,
    tenantId?: string | null,
    dryRun = true
) {
    try {
        const db = getTenantClient(null);
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const capabilities = await adapter.discoverCapabilities();

        // Fetch the full router record so plan steps can use lanIp, dns, wgKeys, etc.
        const routerRecord = await db.router.findUnique({ where: { id: routerId } });
        if (!routerRecord) throw new Error(`Router ${routerId} not found`);

        // Build vendor-aware, capability-gated provisioning plan
        const plan = buildProvisioningPlan(routerRecord, capabilities, dryRun);

        // Execute via adapter method dispatch (works for ALL vendors)
        const result = await executeProvisioningPlan(routerId, tenantId ?? null, plan, { dryRun });

        logger.info("[ProvisionExecution] Completed", {
            routerId,
            tenantId,
            vendor: capabilities.vendor,
            success: result.success,
            successCount: result.successCount,
            failureCount: result.failureCount,
            dryRun,
        });

        return result;
    } catch (error: any) {
        logger.error("[ProvisionExecution] Worker failed", {
            routerId,
            tenantId,
            error: error?.message,
        });
        return { success: false, error: error?.message || "Provision execution failed" };
    }
}
