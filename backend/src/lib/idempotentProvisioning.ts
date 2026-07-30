/**
 * Idempotent Provisioning Module
 *
 * VENDOR-ADAPTER-PROV-003: Vendor-aware resource detection and rollback.
 *
 * This module provides:
 *   1. detectExistingResources() — query router for existing HQ resources (vendor-aware)
 *   2. persistProvisioningState() — write provisioning outcome to DB
 *   3. generateMikroTikRollbackScript() — MikroTik-specific .rsc rollback
 *      (kept as MikroTik-only, clearly named — not called for other vendors)
 *
 * NOTE: generateScriptFromPlan() has been REMOVED.
 * The new provisionExecutor.ts uses adapter method dispatch instead of
 * uploading a .rsc script. MikroTik-specific scripting is kept here
 * only for the rollback use case, clearly named as MikroTik-specific.
 */

import { getTenantClient } from "./tenantPrisma";
import { getRouterAdapter } from "./routerAdapters";
import logger from "@/lib/logger";

// ── Resource Check Result ─────────────────────────────────────────────────────

export interface ResourceCheckResult {
    bridgeExists: boolean;
    poolsExist: boolean;
    profilesExist: boolean;
    firewallRulesExist: boolean;
    queuesExist: boolean;
    routesExist: boolean;
    wireguardExists: boolean;
    /** Vendor of the queried router — affects what resources are meaningful */
    vendor?: string;
}

// ── Detect Existing Resources ─────────────────────────────────────────────────

/**
 * Query a router to detect which HQ INVESTMENT resources already exist.
 * This is called BEFORE provisioning to build skip-lists for duplicate prevention.
 *
 * For MikroTik: uses the REST API directly via adapter.apiRequestPublic()
 * For Omada/UniFi/TPLink: returns false for MikroTik-specific resources
 *   (these vendors don't have the same resource types — the provisioning
 *    engine handles vendor differences at the step level)
 */
export async function detectExistingResources(
    routerId: string,
    tenantId: string | null | undefined
): Promise<ResourceCheckResult> {
    try {
        const adapter = await getRouterAdapter(routerId, tenantId ?? null);
        const vendor = adapter.vendor;

        // For non-MikroTik vendors, these RouterOS-specific checks don't apply.
        // Their resources are managed differently (VLAN/network profiles, etc.)
        // and the provisioning engine handles capability-gating at step level.
        if (vendor !== "mikrotik") {
            logger.debug("[IdempotentProvisioning] Non-MikroTik vendor — skipping RouterOS resource detection", {
                routerId,
                vendor,
            });
            return {
                bridgeExists: false,
                poolsExist: false,
                profilesExist: false,
                firewallRulesExist: false,
                queuesExist: false,
                routesExist: false,
                wireguardExists: false,
                vendor,
            };
        }

        // MikroTik: query existing bridges
        const bridges = await adapter.apiRequestPublic("/interface/bridge", "GET").catch(() => []);
        const hqBridgeExists = (bridges || []).some(
            (b: any) => b.name?.includes("bridge-lan") || b.comment?.includes("HQ")
        );

        // Query existing pools
        const pools = await adapter.apiRequestPublic("/ip/pool", "GET").catch(() => []);
        const hqPoolsExist = (pools || []).some(
            (p: any) => p.name?.includes("hq-") || p.comment?.includes("HQ")
        );

        // Query existing PPP profiles
        const profiles = await adapter.apiRequestPublic("/ppp/profile", "GET").catch(() => []);
        const hqProfilesExist = (profiles || []).some(
            (p: any) => p.name?.includes("hq-") || p.comment?.includes("HQ")
        );

        // Query existing firewall rules with HQ comment
        const firewallRules = await adapter.apiRequestPublic("/ip/firewall/filter", "GET").catch(() => []);
        const hqFirewallExists = (firewallRules || []).some(
            (r: any) => r.comment?.includes("HQ")
        );

        // Query existing queues
        const queues = await adapter.apiRequestPublic("/queue/simple", "GET").catch(() => []);
        const hqQueuesExist = (queues || []).some(
            (q: any) => q.name?.includes("hq-") || q.comment?.includes("HQ")
        );

        // Query existing routes
        const routes = await adapter.apiRequestPublic("/ip/route", "GET").catch(() => []);
        const hqRoutesExist = (routes || []).some(
            (r: any) => r.comment?.includes("HQ")
        );

        // Query WireGuard interface
        const wgInterfaces = await adapter.apiRequestPublic("/interface/wireguard", "GET").catch(() => []);
        const wireguardExists = (wgInterfaces || []).some(
            (i: any) => i.name?.includes("wg-hq") || i.comment?.includes("HQ")
        );

        return {
            bridgeExists: hqBridgeExists,
            poolsExist: hqPoolsExist,
            profilesExist: hqProfilesExist,
            firewallRulesExist: hqFirewallExists,
            queuesExist: hqQueuesExist,
            routesExist: hqRoutesExist,
            wireguardExists,
            vendor: "mikrotik",
        };
    } catch (error: any) {
        logger.warn("[IdempotentProvisioning] Failed to detect existing resources", {
            error: error?.message,
            routerId,
        });
        // On error, assume nothing exists (safe default: will regenerate all)
        return {
            bridgeExists: false,
            poolsExist: false,
            profilesExist: false,
            firewallRulesExist: false,
            queuesExist: false,
            routesExist: false,
            wireguardExists: false,
        };
    }
}

// ── Persist Provisioning State ────────────────────────────────────────────────

/**
 * Persist provisioning state to the database so we can track what was last
 * provisioned and when, enabling incremental updates.
 */
export async function persistProvisioningState(
    routerId: string,
    tenantId: string | null,
    resources: ResourceCheckResult
): Promise<void> {
    try {
        const db = getTenantClient(null);
        await db.router.update({
            where: { id: routerId },
            data: {
                provisioningStatus: "PROVISIONED",
                lastSync: new Date(),
                errorState: null,
            },
        });
    } catch (error: any) {
        logger.error("[IdempotentProvisioning] Failed to persist provisioning state", {
            error: error?.message,
            routerId,
        });
    }
}

// ── MikroTik Rollback Script ──────────────────────────────────────────────────
// CLEARLY NAMED as MikroTik-specific. ONLY called for MikroTik routers.
// Other vendors: rollback is handled at the adapter method level (each step
// declares a rollbackAdapterId in the provisioning plan).

/**
 * Generate a rollback script for a MikroTik router that safely removes
 * all HQ INVESTMENT resources. Used as a last-resort cleanup tool.
 *
 * IMPORTANT: This is MikroTik RouterOS scripting language (.rsc).
 * DO NOT call this for Omada, UniFi, TPLink, or other vendors.
 */
export function generateMikroTikRollbackScript(
    routerName: string,
    resources: ResourceCheckResult
): string {
    if (resources.vendor && resources.vendor !== "mikrotik") {
        throw new Error(
            `generateMikroTikRollbackScript() called for vendor "${resources.vendor}". ` +
            `This function is MikroTik-only. Use adapter rollback methods for other vendors.`
        );
    }

    let script = `# HQ INVESTMENT MikroTik Rollback Script
# Generated for: ${routerName}
# Date: ${new Date().toISOString()}
#
# WARNING: This script will REMOVE all HQ INVESTMENT resources from this router.
# Do NOT run this unless you are absolutely sure you want to remove them.

/log warn "Starting HQ INVESTMENT Rollback..."

`;

    // Remove WireGuard peer and interface
    if (resources.wireguardExists) {
        script += `# 1. Remove WireGuard Interface
:foreach peer in=[/interface wireguard peers find comment~"HQ"] do={
    /interface wireguard peers remove $peer
    /log info "WireGuard peer removed"
}
:if ([:len [/interface wireguard find name="wg-hq"]] > 0) do={
    /interface wireguard remove [find name="wg-hq"]
    /log info "WireGuard interface removed"
}

`;
    }

    // Remove firewall rules
    if (resources.firewallRulesExist) {
        script += `# 2. Remove HQ INVESTMENT Firewall Rules
:foreach rule in=[/ip firewall filter find comment~"HQ"] do={
    /ip firewall filter remove $rule
    /log info "Firewall rule removed"
}
:foreach rule in=[/ipv6 firewall filter find comment~"HQ"] do={
    /ipv6 firewall filter remove $rule
    /log info "IPv6 firewall rule removed"
}

`;
    }

    // Remove NAT rules
    script += `# 3. Remove HQ INVESTMENT NAT Rules
:foreach rule in=[/ip firewall nat find comment~"HQ"] do={
    /ip firewall nat remove $rule
    /log info "NAT rule removed"
}

`;

    // Remove Hotspot and PPPoE
    script += `# 4. Remove Hotspot Configuration
:foreach hs in=[/ip hotspot find comment~"HQ"] do={
    /ip hotspot remove $hs
    /log info "Hotspot server removed"
}
:foreach profile in=[/ip hotspot profile find comment~"HQ"] do={
    /ip hotspot profile remove $profile
    /log info "Hotspot profile removed"
}

# 5. Remove PPPoE Configuration
:foreach server in=[/interface pppoe-server server find comment~"HQ"] do={
    /interface pppoe-server server remove $server
    /log info "PPPoE server removed"
}
:foreach profile in=[/ppp profile find comment~"HQ"] do={
    /ppp profile remove $profile
    /log info "PPP profile removed"
}

`;

    // Remove pools
    if (resources.poolsExist) {
        script += `# 6. Remove IP Pools
:foreach pool in=[/ip pool find comment~"HQ"] do={
    /ip pool remove $pool
    /log info "IP pool removed"
}

`;
    }

    // Remove bridge and interfaces
    if (resources.bridgeExists) {
        script += `# 7. Remove Bridge Configuration
:foreach member in=[/interface bridge port find comment~"HQ"] do={
    /interface bridge port remove $member
    /log info "Bridge port removed"
}
:foreach addr in=[/ip address find comment~"HQ"] do={
    /ip address remove $addr
    /log info "IP address removed"
}
:foreach bridge in=[/interface bridge find comment~"HQ"] do={
    /interface bridge remove $bridge
    /log info "Bridge removed"
}

`;
    }

    // Remove DNS and routes
    script += `# 8. Remove DNS Configuration
:foreach dns in=[/ip dns static find comment~"HQ"] do={
    /ip dns static remove $dns
    /log info "DNS entry removed"
}

# 9. Remove Routes
:foreach route in=[/ip route find comment~"HQ"] do={
    /ip route remove $route
    /log info "Route removed"
}

# 10. Disable RADIUS
/ip hotspot profile set [find default=yes] use-radius=no
/ppp profile set [find name=default] use-radius=no
:foreach radius in=[/radius find comment~"HQ"] do={
    /radius remove $radius
    /log info "RADIUS server removed"
}

# 11. Remove Interface Lists
:foreach list in=[/interface list find name~"hq" or comment~"HQ"] do={
    /interface list remove $list
    /log info "Interface list removed"
}

/log warn "HQ INVESTMENT Rollback completed. Router is now reset to default configuration."
`;

    return script;
}

/**
 * @deprecated Use generateMikroTikRollbackScript() — renamed for clarity.
 * Kept for backward compatibility with any existing callers.
 */
export const generateRollbackScript = generateMikroTikRollbackScript;

// ── Legacy ProvisioningPlan type kept for backward compat ─────────────────────
// The new engine uses routerProvisioningEngine.ts which has its own ProvisioningPlan.
// This type is kept so any legacy code that imports ProvisioningPlan from here still compiles.

export interface ProvisioningPlanStep {
    id: string;
    description: string;
    commands: string[];
    dependsOn?: string[];
    optional?: boolean;
}

export interface ProvisioningPlan {
    routerId: string;
    tenantId: string;
    steps: ProvisioningPlanStep[];
}
