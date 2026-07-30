/**
 * Router Provisioning Engine
 *
 * VENDOR-ADAPTER-PROV-001: Real vendor-aware provisioning plan builder.
 *
 * Replaces the 51-line stub with a fully capability-gated, vendor-aware
 * plan generator. Each step maps to a concrete RouterAdapter method name,
 * so the executor can dispatch via adapter[step.adapterId](step.params).
 *
 * Design:
 *   - Capability-gated: steps are only included if the router supports them
 *   - Vendor-branched: MikroTik steps differ from Omada/UniFi/TPLink
 *   - Dependency-ordered: steps declare dependsOn[] for DAG ordering
 *   - Idempotent: each step is safe to run multiple times
 *   - Rollback-aware: each step optionally declares a rollback method
 *
 * When adding a new vendor:
 *   1. Add a case in buildVendorSteps()
 *   2. Map step adapterId to the adapter method name
 *   3. No other file changes needed
 */

import type { RouterCapabilitySet } from "./routerAdapters";

// ── Step Definition ────────────────────────────────────────────────────────────

export interface ProvisioningStep {
    /** Unique step ID within the plan — used for dependency resolution */
    id: string;
    /** Human-readable description shown in progress UI */
    name: string;
    /** RouterAdapter method to call (e.g. "createBridge", "createDHCP") */
    adapterId: string;
    /** Params to pass to the adapter method */
    params: Record<string, unknown>;
    /** IDs of steps that must complete before this step runs */
    dependsOn: string[];
    /** Whether it is safe to run this step even if the resource already exists */
    idempotent: boolean;
    /** RouterAdapter method for rollback (optional) */
    rollbackAdapterId?: string;
    /** Params to pass to the rollback method */
    rollbackParams?: Record<string, unknown>;
}

export interface ProvisioningPlan {
    id: string;
    routerId: string;
    vendor: string;
    firmwareVersion?: string | null;
    dryRun: boolean;
    steps: ProvisioningStep[];
}

// ── Capability Helper ─────────────────────────────────────────────────────────

function cap(capabilities: Record<string, boolean>, key: string): boolean {
    return capabilities?.[key] === true;
}

// ── Common Steps ──────────────────────────────────────────────────────────────

function buildValidateStep(): ProvisioningStep {
    return {
        id: "validate",
        name: "Validate router connectivity",
        adapterId: "healthCheck",
        params: {},
        dependsOn: [],
        idempotent: true,
    };
}

function buildDiscoverStep(): ProvisioningStep {
    return {
        id: "discover-capabilities",
        name: "Discover router capabilities and firmware version",
        adapterId: "discoverCapabilities",
        params: {},
        dependsOn: ["validate"],
        idempotent: true,
    };
}

// ── MikroTik Steps ────────────────────────────────────────────────────────────

function buildMikroTikSteps(
    router: any,
    capabilities: RouterCapabilitySet
): ProvisioningStep[] {
    const caps = capabilities.capabilities as Record<string, boolean>;
    const steps: ProvisioningStep[] = [];

    // Bridge (always — foundational for MikroTik)
    steps.push({
        id: "create-bridge",
        name: "Create LAN bridge interface",
        adapterId: "createBridge",
        params: {
            name: "bridge-lan",
            comment: "HQ-BILLING",
        },
        dependsOn: ["discover-capabilities"],
        idempotent: true,
        rollbackAdapterId: "apiRequestPublic",
        rollbackParams: { path: "/interface/bridge", method: "DELETE" },
    });

    // DHCP
    if (cap(caps, "dhcp")) {
        steps.push({
            id: "create-dhcp",
            name: "Configure DHCP server",
            adapterId: "createDHCP",
            params: {
                serverName: "dhcp-hq",
                interface: "bridge-lan",
                pool: "hq-dhcp-pool",
                leaseTime: "10m",
                comment: "HQ-BILLING",
            },
            dependsOn: ["create-bridge"],
            idempotent: true,
        });
    }

    // DNS
    if (cap(caps, "dns") && router.dns) {
        steps.push({
            id: "create-dns",
            name: "Configure DNS servers",
            adapterId: "createDNS",
            params: {
                servers: router.dns || "8.8.8.8,8.8.4.4",
            },
            dependsOn: ["create-bridge"],
            idempotent: true,
        });
    }

    // Firewall
    if (cap(caps, "firewall")) {
        steps.push({
            id: "create-firewall",
            name: "Configure basic firewall rules",
            adapterId: "createFirewall",
            params: {
                chain: "forward",
                action: "accept",
                comment: "HQ-BILLING-FORWARD",
            },
            dependsOn: ["create-dhcp"],
            idempotent: true,
        });
    }

    // Queue
    if (cap(caps, "queue")) {
        steps.push({
            id: "create-queue",
            name: "Create default bandwidth queue",
            adapterId: "createQueue",
            params: {
                name: "hq-default-queue",
                target: "0.0.0.0/0",
                maxLimit: "100M/100M",
                comment: "HQ-BILLING",
            },
            dependsOn: ["create-firewall"],
            idempotent: true,
        });
    }

    // PPPoE
    if (cap(caps, "pppoe")) {
        steps.push({
            id: "create-pppoe-profile",
            name: "Create PPPoE default profile",
            adapterId: "createPPPoEProfile",
            params: {
                name: "hq-pppoe-default",
                localAddress: router.lanGateway || "10.0.0.1",
                remoteAddress: "hq-pppoe-pool",
                comment: "HQ-BILLING",
            },
            dependsOn: ["create-dhcp"],
            idempotent: true,
        });
    }

    // Hotspot
    if (cap(caps, "hotspot")) {
        steps.push({
            id: "create-hotspot-profile",
            name: "Create hotspot default profile",
            adapterId: "createHotspotProfile",
            params: {
                name: "hq-hotspot-default",
                sharedUsers: 1,
                comment: "HQ-BILLING",
            },
            dependsOn: ["create-dhcp"],
            idempotent: true,
        });
    }

    // WireGuard (v7.6+ only)
    if (cap(caps, "wireguard") && router.wgEnabled) {
        steps.push({
            id: "configure-wireguard",
            name: "Configure WireGuard VPN tunnel",
            adapterId: "createWireGuardPeer",
            params: {
                interface: "wg0",
                publicKey: router.wgPeerPublicKey,
                allowedAddress: router.wgTunnelIp ? `${router.wgTunnelIp}/32` : "10.200.0.0/24",
                presharedKey: router.wgPresharedKey || "",
            },
            dependsOn: ["discover-capabilities"],
            idempotent: true,
            rollbackAdapterId: "deleteWireGuardPeer",
        });
    }

    return steps;
}

// ── Omada Steps ───────────────────────────────────────────────────────────────

function buildOmadaSteps(
    router: any,
    capabilities: RouterCapabilitySet
): ProvisioningStep[] {
    const caps = capabilities.capabilities as Record<string, boolean>;
    const steps: ProvisioningStep[] = [];

    // VLAN / network config
    if (cap(caps, "vlan")) {
        steps.push({
            id: "create-vlan",
            name: "Configure LAN network/VLAN on Omada site",
            adapterId: "createVLAN",
            params: {
                name: "hq-lan",
                vlanId: 1,
                subnet: "192.168.88.1/24",
            },
            dependsOn: ["discover-capabilities"],
            idempotent: true,
        });
    }

    // DHCP
    if (cap(caps, "dhcp")) {
        steps.push({
            id: "create-dhcp",
            name: "Configure DHCP network on Omada controller",
            adapterId: "createDHCP",
            params: {
                name: "hq-dhcp",
                subnet: router.lanIp || "192.168.88.1/24",
            },
            dependsOn: ["create-vlan"],
            idempotent: true,
        });
    }

    return steps;
}

// ── UniFi Steps ───────────────────────────────────────────────────────────────

function buildUniFiSteps(
    router: any,
    capabilities: RouterCapabilitySet
): ProvisioningStep[] {
    const caps = capabilities.capabilities as Record<string, boolean>;
    const steps: ProvisioningStep[] = [];

    // Network / VLAN
    if (cap(caps, "vlan")) {
        steps.push({
            id: "create-vlan",
            name: "Create LAN network config on UniFi",
            adapterId: "createVLAN",
            params: {
                name: "hq-lan",
                vlanId: 1,
                subnet: router.lanIp || "192.168.88.1/24",
            },
            dependsOn: ["discover-capabilities"],
            idempotent: true,
        });
    }

    // DHCP
    if (cap(caps, "dhcp")) {
        steps.push({
            id: "create-dhcp",
            name: "Configure DHCP on UniFi network",
            adapterId: "createDHCP",
            params: {
                name: "hq-dhcp",
                subnet: router.lanIp || "192.168.88.1/24",
                dhcpStart: "192.168.88.100",
                dhcpStop: "192.168.88.254",
            },
            dependsOn: ["create-vlan"],
            idempotent: true,
        });
    }

    // Firewall
    if (cap(caps, "firewall")) {
        steps.push({
            id: "create-firewall",
            name: "Configure firewall rules on UniFi",
            adapterId: "createFirewall",
            params: {
                name: "hq-allow-lan",
                chain: "forward",
                action: "accept",
                protocol: "all",
            },
            dependsOn: ["create-dhcp"],
            idempotent: true,
        });
    }

    return steps;
}

// ── TPLink Steps ──────────────────────────────────────────────────────────────

function buildTPLinkSteps(
    router: any,
    capabilities: RouterCapabilitySet
): ProvisioningStep[] {
    const caps = capabilities.capabilities as Record<string, boolean>;
    const steps: ProvisioningStep[] = [];

    // DHCP (LAN config)
    if (cap(caps, "dhcp")) {
        steps.push({
            id: "create-dhcp",
            name: "Configure DHCP / LAN settings on TP-Link",
            adapterId: "createDHCP",
            params: {
                gateway: router.lanGateway || "192.168.1.1",
                netmask: "255.255.255.0",
                dhcpStart: "192.168.1.100",
                dhcpEnd: "192.168.1.200",
            },
            dependsOn: ["discover-capabilities"],
            idempotent: true,
        });
    }

    return steps;
}

// ── Plan Builder ──────────────────────────────────────────────────────────────

export function buildProvisioningPlan(
    router: any,
    capabilities: RouterCapabilitySet,
    dryRun = false
): ProvisioningPlan {
    const commonSteps: ProvisioningStep[] = [
        buildValidateStep(),
        buildDiscoverStep(),
    ];

    let vendorSteps: ProvisioningStep[];

    switch (capabilities.vendor) {
        case "omada":
            vendorSteps = buildOmadaSteps(router, capabilities);
            break;
        case "unifi":
            vendorSteps = buildUniFiSteps(router, capabilities);
            break;
        case "tplink":
            vendorSteps = buildTPLinkSteps(router, capabilities);
            break;
        case "future":
            // Future vendor: only validate + discover
            vendorSteps = [];
            break;
        case "mikrotik":
        default:
            vendorSteps = buildMikroTikSteps(router, capabilities);
            break;
    }

    return {
        id: `plan-${router.id}-${Date.now()}`,
        routerId: router.id,
        vendor: capabilities.vendor,
        firmwareVersion: capabilities.firmwareVersion,
        dryRun,
        steps: [...commonSteps, ...vendorSteps],
    };
}

export function getCapabilitySummary(capabilities: RouterCapabilitySet): string[] {
    return capabilities.supportedFeatures;
}
