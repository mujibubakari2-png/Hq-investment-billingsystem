/**
 * Version Compatibility Matrix
 *
 * VENDOR-ADAPTER-004: Authoritative version and feature compatibility matrix.
 *
 * Replaces the old stub implementation with:
 *   - Per-version feature support flags
 *   - Known breaking changes between versions
 *   - Command syntax migration notes
 *   - Automatic capability detection from detected firmware
 */

import { parseVersion, isVersionAtLeast, getSupportedFeatures, type RouterVendor } from "./commandRegistry";

// ── Version Range Definitions ────────────────────────────────────────────────

/** Named RouterOS version landmarks */
export const ROUTEROS_VERSIONS = {
    /** Last stable v6 — baseline for MikroTik support */
    V6_49: "6.49",
    /** First stable v7 */
    V7_0: "7.0",
    /** Introduced WireGuard as built-in package */
    V7_6: "7.6",
    /** RADIUS-over-TLS (RadSec) support */
    V7_10: "7.10",
    /** Enhanced bridge VLAN filtering */
    V7_13: "7.13",
    /** Improved WireGuard API management */
    V7_15: "7.15",
    /** IPv6 prefix delegation improvements */
    V7_17: "7.17",
    /** Latest stable as of 2026 */
    V7_20: "7.20",
} as const;

// ── Compatibility Rule ────────────────────────────────────────────────────────

export interface CompatibilityRule {
    vendor: string;
    firmwareVersion: string;
    feature: string;
    supported: boolean;
    reason?: string;
    /** The minimum version needed to get support, if not supported */
    requiredVersion?: string;
    /** Whether to show a deprecation warning for this version */
    deprecated?: boolean;
    deprecationMessage?: string;
    /** Migration note for operators upgrading between versions */
    migrationNote?: string;
}

// ── MikroTik Version Matrix ───────────────────────────────────────────────────

interface MikroTikVersionCapabilities {
    /** Has REST API (v7+ only) */
    restApi: boolean;
    /** Has built-in WireGuard */
    wireguard: boolean;
    /** RADIUS-over-TLS (RadSec) */
    radSec: boolean;
    /** Enhanced bridge VLAN filtering (per-port pvid, frame-types) */
    enhancedBridge: boolean;
    /** Improved WireGuard API management endpoints */
    wireguardManagement: boolean;
    /** IPv6 prefix delegation improvements */
    ipv6PdEnhanced: boolean;
    /** CAPsMAN v2 (WiFi AP management) */
    capsmanV2: boolean;
    /** nftables-style firewall connection-state field */
    nftablesFirewall: boolean;
    /** One-session-per-host PPPoE enforcement */
    pppoeOneSessionPerHost: boolean;
    /** DHCP use-radius field available */
    dhcpUseRadius: boolean;
}

export function getMikroTikCapabilities(firmwareVersion: string): MikroTikVersionCapabilities {
    return {
        restApi: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_0),
        wireguard: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_6),
        radSec: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_10),
        enhancedBridge: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_0),
        wireguardManagement: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_15),
        ipv6PdEnhanced: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_17),
        capsmanV2: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_13),
        nftablesFirewall: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_13),
        pppoeOneSessionPerHost: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_0),
        dhcpUseRadius: isVersionAtLeast(firmwareVersion, ROUTEROS_VERSIONS.V7_0),
    };
}

// ── API Type Detection ────────────────────────────────────────────────────────

export type ApiType = "REST" | "SSH_CLI" | "CONTROLLER_API" | "HTTP_API" | "LEGACY_API" | "UNKNOWN";

export function detectApiType(vendor: RouterVendor, firmwareVersion: string): ApiType {
    switch (vendor) {
        case "mikrotik": {
            const v = parseVersion(firmwareVersion);
            if (v.major >= 7) return "REST";
            // v6 has a legacy binary API on port 8728, but the system uses HTTP REST via www
            // The REST API was backported in limited form to 6.49 as well
            return "REST"; // We use HTTP REST for both v6 and v7
        }
        case "omada":
            return "CONTROLLER_API";
        case "unifi":
            return "CONTROLLER_API";
        case "tplink":
            return "HTTP_API";
        case "future":
        default:
            return "UNKNOWN";
    }
}

// ── Full Compatibility Rules ─────────────────────────────────────────────────

export function getCompatibilityRules(vendor: string, firmwareVersion?: string | null): CompatibilityRule[] {
    const normalized = (vendor || "mikrotik").toLowerCase() as RouterVendor;
    const version = firmwareVersion || "6.49";
    const rules: CompatibilityRule[] = [];

    if (normalized === "mikrotik") {
        const caps = getMikroTikCapabilities(version);
        const v = parseVersion(version);

        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "PPPoE", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "Hotspot", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "RADIUS", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "DHCP", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "DNS", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "Bridge", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "VLAN", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "Firewall", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "Queue", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "Queue Tree", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "SSH", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "SNMP", supported: true,
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "IPv6", supported: v.major >= 7 || v.minor >= 49,
            reason: v.major < 7 && v.minor < 49 ? "RouterOS 6.49 is the minimum recommended release for IPv6 support" : undefined,
        });

        // REST API
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "REST API", supported: caps.restApi,
            reason: !caps.restApi ? "RouterOS v7.0+ is required for the native REST API" : undefined,
            requiredVersion: !caps.restApi ? ROUTEROS_VERSIONS.V7_0 : undefined,
        });

        // WireGuard
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "WireGuard", supported: caps.wireguard,
            reason: !caps.wireguard ? "Built-in WireGuard requires RouterOS v7.6+" : undefined,
            requiredVersion: !caps.wireguard ? ROUTEROS_VERSIONS.V7_6 : undefined,
        });

        // RadSec
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "RADIUS-over-TLS", supported: caps.radSec,
            reason: !caps.radSec ? "RADIUS-over-TLS (RadSec) requires RouterOS v7.10+" : undefined,
            requiredVersion: !caps.radSec ? ROUTEROS_VERSIONS.V7_10 : undefined,
        });

        // CAPsMAN v2
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "CAPsMAN",
            supported: isVersionAtLeast(version, "6.49"),
        });
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "CAPsMAN v2",
            supported: caps.capsmanV2,
            reason: !caps.capsmanV2 ? "CAPsMAN v2 requires RouterOS v7.13+" : undefined,
            requiredVersion: !caps.capsmanV2 ? ROUTEROS_VERSIONS.V7_13 : undefined,
        });

        // Enhanced Bridge
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "Enhanced Bridge VLAN Filtering",
            supported: caps.enhancedBridge,
            migrationNote: caps.enhancedBridge
                ? "Bridge ports now support frame-types and pvid fields for VLAN segregation."
                : undefined,
        });

        // PPPoE one-session-per-host
        rules.push({
            vendor: "mikrotik", firmwareVersion: version, feature: "PPPoE One-Session-Per-Host",
            supported: caps.pppoeOneSessionPerHost,
        });

        // Deprecation warnings for very old versions
        if (v.major === 6 && v.minor < 49) {
            rules.push({
                vendor: "mikrotik", firmwareVersion: version, feature: "ALL",
                supported: false, deprecated: true,
                deprecationMessage: `RouterOS ${version} is end-of-life. Upgrade to at least 6.49.10 or ideally 7.x for security patches.`,
            });
        }
    }

    if (normalized === "omada") {
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "DHCP", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "DNS", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "Firewall", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "Bridge", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "VLAN", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "Monitoring", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "REST API", supported: true });
        rules.push({ vendor: "omada", firmwareVersion: version, feature: "SNMP", supported: true });
        rules.push({
            vendor: "omada", firmwareVersion: version, feature: "CAPsMAN", supported: true,
            reason: "Omada uses its own controller-managed captive portal, not CAPsMAN",
        });
        rules.push({
            vendor: "omada", firmwareVersion: version, feature: "PPPoE", supported: false,
            reason: "PPPoE is not exposed via the Omada controller API. Configure PPPoE directly on the ER device.",
        });
        rules.push({
            vendor: "omada", firmwareVersion: version, feature: "Hotspot", supported: false,
            reason: "Omada uses controller-managed captive portal rather than RouterOS hotspot.",
        });
        rules.push({
            vendor: "omada", firmwareVersion: version, feature: "RADIUS", supported: false,
            reason: "RADIUS integration for Omada requires controller-side configuration, not individual device API calls.",
        });
        rules.push({
            vendor: "omada", firmwareVersion: version, feature: "WireGuard", supported: false,
            reason: "WireGuard is not supported on TP-Link Omada hardware.",
        });
    }

    if (normalized === "unifi") {
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "DHCP", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "DNS", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "Firewall", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "Bridge", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "VLAN", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "Monitoring", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "REST API", supported: true });
        rules.push({ vendor: "unifi", firmwareVersion: version, feature: "SNMP", supported: true });
        rules.push({
            vendor: "unifi", firmwareVersion: version, feature: "PPPoE", supported: false,
            reason: "PPPoE is not supported through UniFi Network Application API.",
        });
        rules.push({
            vendor: "unifi", firmwareVersion: version, feature: "Hotspot", supported: false,
            reason: "UniFi uses its own guest portal, not a MikroTik-style Hotspot.",
        });
        rules.push({
            vendor: "unifi", firmwareVersion: version, feature: "WireGuard", supported: false,
            reason: "WireGuard is not natively supported by UniFi Network Application API.",
        });
    }

    if (normalized === "tplink") {
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "DHCP", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "DNS", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "Firewall", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "Bridge", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "VLAN", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "Monitoring", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "REST API", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "SSH", supported: true });
        rules.push({ vendor: "tplink", firmwareVersion: version, feature: "SNMP", supported: true });
        rules.push({
            vendor: "tplink", firmwareVersion: version, feature: "PPPoE", supported: false,
            reason: "PPPoE server is not supported on TP-Link Business routers via API.",
        });
        rules.push({
            vendor: "tplink", firmwareVersion: version, feature: "Hotspot", supported: false,
            reason: "Hotspot is not supported on TP-Link Business routers via API.",
        });
        rules.push({
            vendor: "tplink", firmwareVersion: version, feature: "WireGuard", supported: false,
            reason: "WireGuard is not supported on TP-Link Business hardware.",
        });
    }

    return rules;
}

// ── Capability Set Builder ────────────────────────────────────────────────────

/**
 * Build the full capability set for a router — combines static rules with
 * command registry feature detection.
 */
export function buildCapabilitySet(
    vendor: RouterVendor,
    firmwareVersion: string,
    detectedPackages?: string[]
): {
    capabilities: Record<string, boolean>;
    supportedFeatures: string[];
    apiType: ApiType;
    vendor: RouterVendor;
    firmwareVersion: string;
    deprecated: boolean;
    deprecationMessage?: string;
} {
    const rules = getCompatibilityRules(vendor, firmwareVersion);
    const apiType = detectApiType(vendor, firmwareVersion);

    // Start with command registry features
    const registryFeatures = getSupportedFeatures(vendor, firmwareVersion);

    // Build capabilities from rules
    const capabilities: Record<string, boolean> = {
        pppoe: false,
        hotspot: false,
        radius: false,
        dhcp: false,
        dns: false,
        wireguard: false,
        firewall: false,
        queue: false,
        queueTree: false,
        ipv6: false,
        bridge: false,
        vlan: false,
        snmp: false,
        capsman: false,
        restApi: false,
        api: false,
        ssh: false,
        certificates: false,
        monitoring: false,
    };

    const featureToCapabilityKey: Record<string, string> = {
        "PPPoE": "pppoe",
        "Hotspot": "hotspot",
        "RADIUS": "radius",
        "DHCP": "dhcp",
        "DNS": "dns",
        "WireGuard": "wireguard",
        "Firewall": "firewall",
        "Queue": "queue",
        "Queue Tree": "queueTree",
        "IPv6": "ipv6",
        "Bridge": "bridge",
        "VLAN": "vlan",
        "SNMP": "snmp",
        "CAPsMAN": "capsman",
        "REST API": "restApi",
        "SSH": "ssh",
        "Monitoring": "monitoring",
    };

    const supportedFeatures: string[] = [];
    let deprecated = false;
    let deprecationMessage: string | undefined;

    rules.forEach(rule => {
        if (rule.deprecated) {
            deprecated = true;
            deprecationMessage = rule.deprecationMessage;
            return;
        }
        if (rule.feature === "ALL") return;

        if (rule.supported) {
            supportedFeatures.push(rule.feature);
            const capKey = featureToCapabilityKey[rule.feature];
            if (capKey) capabilities[capKey] = true;
        }
    });

    capabilities.api = capabilities.restApi || capabilities.ssh;

    // If packages are detected (MikroTik), override with live data
    if (detectedPackages && vendor === "mikrotik") {
        const pkgSet = new Set(detectedPackages.map(p => p.toLowerCase()));
        if (pkgSet.has("wireless")) capabilities.capsman = true;
        if (pkgSet.has("ipv6")) capabilities.ipv6 = true;
        if (pkgSet.has("ppp") || pkgSet.has("pppoe")) capabilities.pppoe = true;
        if (pkgSet.has("hotspot")) capabilities.hotspot = true;
        if (pkgSet.has("security")) capabilities.certificates = true;
        if (pkgSet.has("ntp")) {
            // no capability flag but useful info
        }
    }

    return {
        vendor,
        firmwareVersion,
        capabilities,
        supportedFeatures: Array.from(new Set(supportedFeatures)),
        apiType,
        deprecated,
        deprecationMessage,
    };
}
