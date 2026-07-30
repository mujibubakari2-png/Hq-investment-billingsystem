/**
 * Router Capability Utilities
 *
 * VENDOR-ADAPTER-FE-001: Frontend utility for vendor-aware capability checks.
 *
 * Usage:
 *   hasCapability(router, 'pppoe')   // true if PPPoE is supported
 *   getVendorLabel(router.vendor)    // "MikroTik", "Omada", etc.
 *   isMikroTik(router)              // true for MikroTik routers
 *
 * This is the SINGLE source of truth for what features each vendor supports
 * in the frontend. All conditional UI should use these helpers, never
 * inline vendor string checks.
 */

import type { Router } from '../types';

// ── Vendor Type ───────────────────────────────────────────────────────────────

export type RouterVendor = 'mikrotik' | 'omada' | 'unifi' | 'tplink' | 'future' | 'unknown';

// ── Vendor Normalisation ──────────────────────────────────────────────────────

export function normalizeVendor(vendor?: string | null, type?: string | null): RouterVendor {
    const v = (vendor ?? type ?? '').toLowerCase().trim();
    if (v.includes('omada')) return 'omada';
    if (v.includes('unifi') || v.includes('ubiquiti')) return 'unifi';
    if (v === 'tplink' || v.includes('tp-link') || v.includes('tp link')) return 'tplink';
    if (v === 'future') return 'future';
    if (v === '' || v === 'unknown') return 'unknown';
    // Default: anything else (including 'mikrotik', 'MikroTik', 'routeros') → mikrotik
    return 'mikrotik';
}

export function getVendorLabel(vendor?: string | null): string {
    switch (normalizeVendor(vendor)) {
        case 'omada':   return 'TP-Link Omada';
        case 'unifi':   return 'Ubiquiti UniFi';
        case 'tplink':  return 'TP-Link Business';
        case 'future':  return 'Custom Vendor';
        default:        return 'MikroTik';
    }
}

export function getVendorShortLabel(vendor?: string | null): string {
    switch (normalizeVendor(vendor)) {
        case 'omada':  return 'Omada';
        case 'unifi':  return 'UniFi';
        case 'tplink': return 'TP-Link';
        case 'future': return 'Custom';
        default:       return 'MikroTik';
    }
}

// ── Vendor Predicates ─────────────────────────────────────────────────────────

export function isMikroTik(router: Router): boolean {
    return normalizeVendor(router.vendor, router.type) === 'mikrotik';
}

export function isOmada(router: Router): boolean {
    return normalizeVendor(router.vendor, router.type) === 'omada';
}

export function isUniFi(router: Router): boolean {
    return normalizeVendor(router.vendor, router.type) === 'unifi';
}

export function isTPLink(router: Router): boolean {
    return normalizeVendor(router.vendor, router.type) === 'tplink';
}

// ── Feature Sets Per Vendor ───────────────────────────────────────────────────
// These are the DEFAULT capabilities if the router hasn't been discovered yet.
// After discovery, use hasCapability() which checks the live capabilities JSON.

const MIKROTIK_FEATURES: readonly string[] = [
    'pppoe', 'hotspot', 'dhcp', 'dns', 'firewall', 'queue', 'bridge',
    'vlan', 'wireguard', 'vpn', 'radius', 'backup', 'reboot', 'winbox',
    'script', 'ipv6', 'bgp', 'ospf',
];

const OMADA_FEATURES: readonly string[] = [
    'dhcp', 'vlan', 'firewall', 'reboot', 'monitor',
];

const UNIFI_FEATURES: readonly string[] = [
    'dhcp', 'vlan', 'firewall', 'reboot', 'monitor',
];

const TPLINK_FEATURES: readonly string[] = [
    'dhcp', 'reboot', 'monitor',
];

const FUTURE_FEATURES: readonly string[] = [];

function getDefaultFeaturesForVendor(vendor: RouterVendor): readonly string[] {
    switch (vendor) {
        case 'omada':  return OMADA_FEATURES;
        case 'unifi':  return UNIFI_FEATURES;
        case 'tplink': return TPLINK_FEATURES;
        case 'future': return FUTURE_FEATURES;
        default:       return MIKROTIK_FEATURES;
    }
}

// ── Capability Check ──────────────────────────────────────────────────────────

/**
 * Check whether a router supports a given feature.
 *
 * Priority order:
 *   1. Live capabilities JSON from the router (most accurate, from discoverCapabilities())
 *   2. supportedFeatures string array (from API)
 *   3. Default per-vendor feature set (fallback when not yet discovered)
 */
export function hasCapability(router: Router, feature: string): boolean {
    // 1. Check live capabilities JSON
    if (router.capabilities && typeof router.capabilities === 'object') {
        const caps = router.capabilities as Record<string, boolean>;
        if (feature in caps) return caps[feature] === true;
    }

    // 2. Check supportedFeatures array
    if (router.supportedFeatures && router.supportedFeatures.length > 0) {
        return router.supportedFeatures.includes(feature);
    }

    // 3. Fall back to default vendor feature set
    const vendor = normalizeVendor(router.vendor, router.type);
    return getDefaultFeaturesForVendor(vendor).includes(feature);
}

/** Returns all features this router supports (from live data or vendor defaults) */
export function getSupportedFeatures(router: Router): string[] {
    if (router.supportedFeatures && router.supportedFeatures.length > 0) {
        return router.supportedFeatures;
    }
    const vendor = normalizeVendor(router.vendor, router.type);
    return [...getDefaultFeaturesForVendor(vendor)];
}

// ── Console URL ───────────────────────────────────────────────────────────────

/**
 * Returns the web console URL for non-MikroTik vendors.
 * Returns null for MikroTik (uses WinBox instead).
 */
export function getVendorConsoleUrl(router: Router): string | null {
    const vendor = normalizeVendor(router.vendor, router.type);
    const host = router.host || '';
    const port = router.apiPort || router.port;

    switch (vendor) {
        case 'omada':
            return `https://${host}:${port || 8043}`;
        case 'unifi':
            return `https://${host}:${port || 443}`;
        case 'tplink':
            return `https://${host}:${port || 443}`;
        default:
            return null; // MikroTik — WinBox
    }
}

// ── Health / Status Helpers ────────────────────────────────────────────────────

export function getHealthColor(healthStatus?: string | null): string {
    switch (healthStatus) {
        case 'HEALTHY':      return '#16a34a';
        case 'DEGRADED':     return '#d97706';
        case 'UNREACHABLE':  return '#dc2626';
        default:             return '#9ca3af';
    }
}

export function getProvisioningLabel(status?: string | null): string {
    switch (status) {
        case 'PROVISIONED':     return 'Provisioned';
        case 'IN_PROGRESS':     return 'Provisioning…';
        case 'FAILED':          return 'Failed';
        case 'PARTIAL':         return 'Partial';
        case 'DRY_RUN':         return 'Dry Run';
        case 'NOT_PROVISIONED': return 'Not Provisioned';
        default:                return status ?? 'Unknown';
    }
}

export function getProvisioningColor(status?: string | null): string {
    switch (status) {
        case 'PROVISIONED': return '#16a34a';
        case 'IN_PROGRESS': return '#2563eb';
        case 'FAILED':      return '#dc2626';
        case 'PARTIAL':     return '#d97706';
        default:            return '#9ca3af';
    }
}
