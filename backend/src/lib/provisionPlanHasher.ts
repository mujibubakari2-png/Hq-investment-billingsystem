/**
 * Provisioning Plan Hasher
 *
 * ENTERPRISE-008: Deterministic plan fingerprinting for traceability.
 *
 * Each provisioning plan gets a stable SHA-256 hash based on its content
 * (vendor, firmware, steps, params). This allows:
 *
 *   - Detecting if the same plan is re-run (idempotency)
 *   - Identifying which plan version a router was provisioned with
 *   - Comparing plan "before" vs "after" when config changes
 *
 * The plan hash is stored on the router record as `lastPlanHash` and in each
 * RouterProvisioningLog entry.
 *
 * Plan Transaction ID format:
 *   PROV-{routerId[:8]}-{timestamp}-{hash[:8]}
 *   e.g. PROV-abc12345-1721901234-f3a1b2c4
 */

import { createHash } from "crypto";
import type { ProvisioningPlan } from "./routerProvisioningEngine";

/**
 * Compute a deterministic SHA-256 hash of a provisioning plan.
 * Steps are sorted by ID before hashing to ensure stability.
 */
export function hashProvisioningPlan(plan: ProvisioningPlan): string {
    const canonical = {
        vendor: plan.vendor,
        firmwareVersion: plan.firmwareVersion ?? null,
        steps: [...plan.steps]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(s => ({
                id: s.id,
                adapterId: s.adapterId,
                params: s.params,
                dependsOn: [...s.dependsOn].sort(),
                rollbackAdapterId: s.rollbackAdapterId ?? null,
            })),
    };
    return createHash("sha256")
        .update(JSON.stringify(canonical))
        .digest("hex");
}

/**
 * Build a human-readable Transaction ID for a provisioning run.
 * Embedded in logs and DB for correlation.
 */
export function buildProvisionTransactionId(routerId: string, planHash: string): string {
    const ts = Math.floor(Date.now() / 1000);
    const shortRouterId = routerId.replace(/-/g, "").slice(0, 8);
    const shortHash = planHash.slice(0, 8);
    return `PROV-${shortRouterId}-${ts}-${shortHash}`;
}

/**
 * Attach plan metadata to a plan object.
 * Call this after buildProvisioningPlan() to enrich it.
 */
export function enrichPlan(plan: ProvisioningPlan): ProvisioningPlan & {
    hash: string;
    transactionId: string;
    version: string;
} {
    const hash = hashProvisioningPlan(plan);
    const transactionId = buildProvisionTransactionId(plan.routerId, hash);
    const version = `v${plan.steps.length}.${hash.slice(0, 4)}`;
    return { ...plan, hash, transactionId, version };
}
