/**
 * Configuration Drift Detector
 *
 * ENTERPRISE-007: Detect when a router's actual configuration has diverged
 * from the desired (provisioned) configuration.
 *
 * Flow:
 *   1. After provisioning, a "desired config snapshot" is recorded
 *   2. During each discovery sweep, the live config is sampled
 *   3. A diff is computed between desired vs actual
 *   4. Drift items are classified as: ADDED, REMOVED, CHANGED
 *   5. Severity: CRITICAL (security rules), HIGH (firewall/PPPoE), MEDIUM, LOW
 *   6. Auto-remediation can be triggered for LOW/MEDIUM drift (optional)
 *
 * Storage:
 *   - Desired config: Redis key `router:config:desired:{routerId}` (JSON)
 *   - Drift report:   Redis key `router:config:drift:{routerId}` (JSON, 24h TTL)
 *   - Drift history:  Written to RouterProvisioningLog (action=config-drift)
 *
 * Usage:
 *   // After provisioning — capture desired state
 *   await captureDesiredConfig(routerId, tenantId, { ... });
 *
 *   // During discovery — compute drift
 *   const report = await detectConfigDrift(routerId, tenantId, liveConfig);
 *   if (report.hasDrift) console.log(report.items);
 */

import { getRedisClient } from "./cache";
import { getTenantClient } from "./tenantPrisma";
import logger from "@/lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DriftSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type DriftType = "ADDED" | "REMOVED" | "CHANGED";

export interface DriftItem {
    path: string;            // e.g. "firewall.rules[2].action"
    type: DriftType;
    severity: DriftSeverity;
    desiredValue: unknown;
    actualValue: unknown;
    description: string;
}

export interface DriftReport {
    routerId: string;
    tenantId: string | null;
    detectedAt: string;
    hasDrift: boolean;
    driftScore: number;       // 0 (clean) to 100 (severe)
    items: DriftItem[];
    summary: string;
    autoRemediationPossible: boolean;
}

export interface RouterConfigSnapshot {
    capturedAt: string;
    planId?: string;
    planHash?: string;
    vendor: string;
    firmwareVersion?: string | null;
    features: {
        pppoe?: boolean;
        hotspot?: boolean;
        dhcp?: boolean;
        firewall?: boolean;
        wireguard?: boolean;
        radius?: boolean;
        bridge?: boolean;
        vlan?: boolean;
        queue?: boolean;
        dns?: boolean;
    };
    /** Flat key-value map of sampled config values */
    values: Record<string, unknown>;
}

// ── Redis Keys ────────────────────────────────────────────────────────────────

const desiredKey = (id: string) => `router:config:desired:${id}`;
const driftKey   = (id: string) => `router:config:drift:${id}`;
const TTL_DESIRED = 30 * 24 * 3600; // 30 days
const TTL_DRIFT   = 24 * 3600;      // 24 hours

// ── Severity Rules ────────────────────────────────────────────────────────────

function classifySeverity(path: string, type: DriftType): DriftSeverity {
    if (path.includes("firewall") || path.includes("radius")) {
        return type === "REMOVED" ? "CRITICAL" : "HIGH";
    }
    if (path.includes("pppoe") || path.includes("wireguard") || path.includes("bridge")) {
        return "HIGH";
    }
    if (path.includes("dhcp") || path.includes("dns") || path.includes("queue")) {
        return "MEDIUM";
    }
    if (path.includes("vlan") || path.includes("hotspot")) {
        return "MEDIUM";
    }
    return "LOW";
}

function scoreItem(item: DriftItem): number {
    const base: Record<DriftSeverity, number> = {
        CRITICAL: 30,
        HIGH:     15,
        MEDIUM:   8,
        LOW:      3,
        INFO:     1,
    };
    return base[item.severity];
}

// ── Diff Engine ───────────────────────────────────────────────────────────────

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
        } else {
            result[fullKey] = value;
        }
    }
    return result;
}

function computeDiff(desired: RouterConfigSnapshot, actual: RouterConfigSnapshot): DriftItem[] {
    const items: DriftItem[] = [];

    // Diff features
    const desiredFlat = flattenObject({ ...desired.features, ...desired.values }, "");
    const actualFlat  = flattenObject({ ...actual.features, ...actual.values }, "");

    const allKeys = new Set([...Object.keys(desiredFlat), ...Object.keys(actualFlat)]);

    for (const path of allKeys) {
        const dVal = desiredFlat[path];
        const aVal = actualFlat[path];

        if (dVal === undefined && aVal !== undefined) {
            const type: DriftType = "ADDED";
            items.push({
                path, type,
                severity: classifySeverity(path, type),
                desiredValue: undefined,
                actualValue: aVal,
                description: `"${path}" was added manually (not in desired config)`,
            });
        } else if (dVal !== undefined && aVal === undefined) {
            const type: DriftType = "REMOVED";
            items.push({
                path, type,
                severity: classifySeverity(path, type),
                desiredValue: dVal,
                actualValue: undefined,
                description: `"${path}" was removed from router (expected ${JSON.stringify(dVal)})`,
            });
        } else if (JSON.stringify(dVal) !== JSON.stringify(aVal)) {
            const type: DriftType = "CHANGED";
            items.push({
                path, type,
                severity: classifySeverity(path, type),
                desiredValue: dVal,
                actualValue: aVal,
                description: `"${path}" changed from ${JSON.stringify(dVal)} to ${JSON.stringify(aVal)}`,
            });
        }
    }

    return items;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Capture and persist the desired configuration snapshot after provisioning.
 * Call this at the end of a successful provisioning run.
 */
export async function captureDesiredConfig(
    routerId: string,
    snapshot: RouterConfigSnapshot
): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
        await redis.set(
            desiredKey(routerId),
            JSON.stringify(snapshot),
            "EX",
            TTL_DESIRED
        );
    }
    logger.info(`[ConfigDrift] Captured desired config for router ${routerId}`, {
        planId: snapshot.planId,
        vendor: snapshot.vendor,
    });
}

/**
 * Get the stored desired config snapshot for a router.
 * Returns null if no snapshot exists (router was never provisioned by this system).
 */
export async function getDesiredConfig(routerId: string): Promise<RouterConfigSnapshot | null> {
    const redis = getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(desiredKey(routerId));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as RouterConfigSnapshot;
    } catch {
        return null;
    }
}

/**
 * Compare actual (live) config against desired config and produce a drift report.
 * This should be called during each discovery sweep.
 */
export async function detectConfigDrift(
    routerId: string,
    tenantId: string | null,
    actualSnapshot: RouterConfigSnapshot
): Promise<DriftReport> {
    const desired = await getDesiredConfig(routerId);

    if (!desired) {
        return {
            routerId, tenantId,
            detectedAt: new Date().toISOString(),
            hasDrift: false,
            driftScore: 0,
            items: [],
            summary: "No desired config snapshot found — router may not have been provisioned by this system",
            autoRemediationPossible: false,
        };
    }

    const items = computeDiff(desired, actualSnapshot);
    const driftScore = Math.min(100, items.reduce((sum, item) => sum + scoreItem(item), 0));
    const hasDrift = items.length > 0;

    const criticalCount = items.filter(i => i.severity === "CRITICAL").length;
    const highCount = items.filter(i => i.severity === "HIGH").length;
    const autoRemediationPossible = hasDrift &&
        criticalCount === 0 &&
        items.every(i => i.severity === "LOW" || i.severity === "MEDIUM");

    const summary = hasDrift
        ? `${items.length} drift item(s) detected (score: ${driftScore}/100) — ${criticalCount} critical, ${highCount} high`
        : "Configuration matches desired state (no drift)";

    const report: DriftReport = {
        routerId, tenantId,
        detectedAt: new Date().toISOString(),
        hasDrift,
        driftScore,
        items,
        summary,
        autoRemediationPossible,
    };

    // Persist drift report to Redis (24h TTL)
    const redis = getRedisClient();
    if (redis) {
        await redis.set(driftKey(routerId), JSON.stringify(report), "EX", TTL_DRIFT);
    }

    // Write to audit log if drift found
    if (hasDrift) {
        logger.warn(`[ConfigDrift] Drift detected on router ${routerId}`, {
            score: driftScore,
            items: items.length,
            critical: criticalCount,
        });

        const db = getTenantClient(null);
        await db.routerLog.create({
            data: {
                routerId,
                tenantId,
                action: "config-drift",
                status: criticalCount > 0 ? "error" : "failed",
                details: summary.slice(0, 1000),
            },
        }).catch(() => { /* non-fatal */ });
    }

    return report;
}

/**
 * Get the latest drift report for a router (from Redis cache).
 */
export async function getLatestDriftReport(routerId: string): Promise<DriftReport | null> {
    const redis = getRedisClient();
    if (!redis) return null;
    const raw = await redis.get(driftKey(routerId));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as DriftReport;
    } catch {
        return null;
    }
}
