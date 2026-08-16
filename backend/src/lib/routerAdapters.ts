/**
 * Router Adapter Interface + Factory
 *
 * VENDOR-ADAPTER-009: Central vendor adapter interface, factory, and registry.
 *
 * This file defines:
 *   1. RouterAdapter interface — the contract every vendor MUST implement
 *   2. RouterCapabilitySet — the capability structure returned by discoverCapabilities()
 *   3. RouterAdapterContext — the data passed to every adapter constructor
 *   4. createRouterAdapter() — factory that returns the correct adapter for a vendor
 *   5. getRouterAdapter()   — fetches router from DB + decrypts + creates adapter
 *
 * Adding a new vendor:
 *   1. Create src/lib/adapters/YourVendorAdapter.ts implementing RouterAdapter
 *   2. Add the vendor string to RouterVendor type
 *   3. Register it in createRouterAdapter() switch
 *   4. Add capability matrix to versionCompatibility.ts
 *   5. Add command templates to commandRegistry.ts
 *   NO other files need to change.
 */

import { getTenantClient } from "./tenantPrisma";
import { decryptRouterFields } from "./encryption";
import logger from "@/lib/logger";
import { MikroTikAdapter } from "./adapters/MikroTikAdapter";
import { OmadaAdapter } from "./adapters/OmadaAdapter";
import { UniFiAdapter } from "./adapters/UniFiAdapter";
import { TPLinkAdapter } from "./adapters/TPLinkAdapter";

// ── Vendor Type ───────────────────────────────────────────────────────────────

export type RouterVendor = "mikrotik" | "omada" | "unifi" | "tplink" | "future";

// ── Context passed to every adapter ──────────────────────────────────────────

export interface RouterAdapterContext {
    id?: string;
    tenantId?: string | null;
    vendor?: string | null;
    model?: string | null;
    architecture?: string | null;
    firmwareVersion?: string | null;
    apiType?: string | null;
    host?: string | null;
    port?: number | null;
    apiPort?: number | null;
    username?: string | null;
    password?: string | null;
    capabilities?: Record<string, boolean> | string[] | null;
    // Controller-specific extras (passed through for Omada/UniFi)
    siteId?: string | null;
    site?: string | null;
}

// ── Capability Set returned by discoverCapabilities() ─────────────────────────

export interface RouterCapabilitySet {
    vendor: RouterVendor;
    firmwareVersion?: string | null;
    architecture?: string | null;
    apiType: string;
    supportedFeatures: string[];
    capabilities: Record<string, boolean>;
}

// ── Core Adapter Interface ────────────────────────────────────────────────────
// Every method must be implemented. Unsupported features return
// { success: false, message: "<feature> is not supported by <Adapter>" }
// NOT throw — callers should handle success:false gracefully.

export interface RouterAdapter {
    readonly name: string;
    readonly vendor: RouterVendor;

    // ── Lifecycle ────────────────────────────────────────────────────────────
    connect(): Promise<{ success: boolean; message: string; data?: any; info?: any }>;
    disconnect(): Promise<{ success: boolean; message: string; data?: any }>;
    healthCheck(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;

    // ── User Management ───────────────────────────────────────────────────────
    createUser(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    deleteUser(username: string): Promise<{ success: boolean; message: string; data?: any }>;

    // ── PPPoE ─────────────────────────────────────────────────────────────────
    createPPPoE(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    listPPPoEProfiles(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createPPPoEProfile(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;

    // ── Hotspot ───────────────────────────────────────────────────────────────
    createHotspot(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    listHotspotProfiles(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createHotspotProfile(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    // PROV-GAP-001: server-side hotspot provisioning (distinct from the
    // per-user profile above). Optional since only MikroTik implements these
    // so far; other vendors configure their captive portal differently.
    createIpPool?(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    assignInterfaceAddress?(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createHotspotServerProfile?(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createHotspotServer?(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;

    // ── Service Lifecycle (activate/suspend) ──────────────────────────────────
    // These are in the interface (NOT optional via `as any` casts anymore)
    activateService?(
        username: string,
        password: string,
        profileName: string,
        serviceType: "pppoe" | "hotspot",
        expiresAt?: Date
    ): Promise<{ success: boolean; message: string; data?: any }>;
    suspendService?(
        username: string,
        serviceType: "pppoe" | "hotspot"
    ): Promise<{ success: boolean; message: string; data?: any }>;

    // ── Network Infrastructure ────────────────────────────────────────────────
    createQueue(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createFirewall(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createDHCP(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createDNS(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createBridge(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    createVLAN(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;

    // ── Session Management ────────────────────────────────────────────────────
    disconnectSession?(sessionId: string): Promise<{ success: boolean; message: string; data?: any }>;

    // ── VPN / WireGuard ───────────────────────────────────────────────────────
    createVpnUser?(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    deleteVpnUser?(username: string): Promise<{ success: boolean; message: string; data?: any }>;
    createWireGuardPeer?(peer: any): Promise<{ success: boolean; message: string; data?: any }>;
    deleteWireGuardPeer?(publicKeyOrComment: string): Promise<{ success: boolean; message: string; data?: any }>;

    // ── Hotspot Settings (HQ INVESTMENT portal) ───────────────────────────────
    pushHotspotSettings?(settings: any): Promise<{ success: boolean; message?: string; data?: any }>;

    // ── Package→Profile helper ────────────────────────────────────────────────
    createProfileFromPackage?(
        name: string,
        uploadSpeed: number,
        uploadUnit: string,
        downloadSpeed: number,
        downloadUnit: string,
        type: string,
        devices: number
    ): Promise<any>;

    // ── Direct API access (MikroTik REST path passthrough, etc.) ─────────────
    apiRequestPublic(path: string, method?: string, body?: any): Promise<any>;

    // ── Operations ────────────────────────────────────────────────────────────
    monitor(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    backup(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    restore(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;
    reboot(payload?: any): Promise<{ success: boolean; message: string; data?: any }>;

    // ── Capability Discovery ──────────────────────────────────────────────────
    discoverCapabilities(): Promise<RouterCapabilitySet>;
}

// ── Vendor Normalization ──────────────────────────────────────────────────────

export function normalizeRouterVendor(vendor?: string | null): RouterVendor {
    const normalized = (vendor ?? "mikrotik").toLowerCase().trim();
    if (normalized.includes("omada")) return "omada";
    if (normalized.includes("unifi") || normalized.includes("ubiquiti")) return "unifi";
    // tplink match MUST come before "mikrotik" default — be explicit
    if (normalized === "tplink" || normalized.includes("tp-link") || normalized.includes("tp link")) return "tplink";
    if (normalized === "future" || normalized.includes("future")) return "future";
    // MikroTik is the default for any unknown/legacy "MikroTik" string
    return "mikrotik";
}

// ── Future Vendor Placeholder ─────────────────────────────────────────────────
// This satisfies the interface contract. Replace with a real implementation
// when a new vendor needs to be supported.

class FutureVendorAdapter implements RouterAdapter {
    readonly name = "FutureVendorAdapter";
    readonly vendor: RouterVendor = "future";
    
    constructor(private context: RouterAdapterContext) {}

    private u(feature: string) {
        return { success: false, message: `${feature}: FutureVendor adapter is a placeholder. Implement a real adapter.` };
    }

    async connect() { return this.u("connect"); }
    async disconnect() { return this.u("disconnect"); }
    async healthCheck() { return this.u("healthCheck"); }
    async createUser() { return this.u("createUser"); }
    async deleteUser(_: string) { return this.u("deleteUser"); }
    async createPPPoE() { return this.u("createPPPoE"); }
    async listPPPoEProfiles() { return this.u("listPPPoEProfiles"); }
    async createPPPoEProfile() { return this.u("createPPPoEProfile"); }
    async createHotspot() { return this.u("createHotspot"); }
    async listHotspotProfiles() { return this.u("listHotspotProfiles"); }
    async createHotspotProfile() { return this.u("createHotspotProfile"); }
    async createQueue() { return this.u("createQueue"); }
    async createFirewall() { return this.u("createFirewall"); }
    async createDHCP() { return this.u("createDHCP"); }
    async createDNS() { return this.u("createDNS"); }
    async createBridge() { return this.u("createBridge"); }
    async createVLAN() { return this.u("createVLAN"); }
    async monitor() { return this.u("monitor"); }
    async backup() { return this.u("backup"); }
    async restore() { return this.u("restore"); }
    async reboot() { return this.u("reboot"); }
    async apiRequestPublic(_path: string) { return this.u("apiRequestPublic"); }
    async discoverCapabilities(): Promise<RouterCapabilitySet> {
        return {
            vendor: "future",
            firmwareVersion: null,
            architecture: null,
            apiType: "UNKNOWN",
            supportedFeatures: [],
            capabilities: {},
        };
    }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRouterAdapter(context: RouterAdapterContext): RouterAdapter {
    const vendor = normalizeRouterVendor(context.vendor);
    switch (vendor) {
        case "omada":
            return new OmadaAdapter(context);
        case "unifi":
            return new UniFiAdapter(context);
        case "tplink":
            return new TPLinkAdapter(context);
        case "future":
            return new FutureVendorAdapter(context);
        case "mikrotik":
        default:
            return new MikroTikAdapter(context);
    }
}

// ── DB Lookup → Adapter ───────────────────────────────────────────────────────

export async function getRouterAdapter(
    routerId: string,
    tenantId?: string | null
): Promise<RouterAdapter> {
    const db = getTenantClient(null);

    let router: any = null;
    if (typeof db.router.findUnique === "function") {
        router = await db.router.findUnique({ where: { id: routerId } });
    } else if (typeof db.router.findFirst === "function") {
        router = await db.router.findFirst({ where: { id: routerId } });
    }

    if (!router) throw new Error(`Router not found: ${routerId}`);

    // ── Tenant isolation enforcement ──────────────────────────────────────────
    // If caller provides tenantId, enforce that the router belongs to that tenant.
    // Skip check when router.tenantId is null (platform-level/shared router).
    if (
        tenantId !== undefined &&
        tenantId !== null &&
        router.tenantId !== null &&
        router.tenantId !== undefined &&
        router.tenantId !== tenantId
    ) {
        logger.warn("[RouterAdapters] Cross-tenant router access attempt blocked", {
            routerId,
            routerTenantId: router.tenantId,
            requestingTenantId: tenantId,
        });
        throw new Error("Unauthorized: This router belongs to another tenant");
    }

    const decrypted = decryptRouterFields(router as any);

    // ── Vendor detection: prefer `vendor` field, fall back to `type` (legacy) ─
    // Bug fix for issue #7: `type` field defaulted to "MikroTik" string for old
    // rows, masking the actual vendor. Now we check `vendor` first.
    const vendorField = decrypted.vendor || decrypted.type || "mikrotik";

    return createRouterAdapter({
        id: router.id,
        tenantId: router.tenantId ?? null,
        vendor: vendorField,
        model: decrypted.model ?? null,
        architecture: decrypted.architecture ?? null,
        firmwareVersion: decrypted.firmwareVersion ?? null,
        apiType: decrypted.apiType ?? null,
        host: decrypted.host ?? null,
        port: decrypted.port ?? null,
        apiPort: decrypted.apiPort ?? decrypted.restPort ?? null,
        username: decrypted.username ?? null,
        password: decrypted.password ?? null,
        siteId: (decrypted as any).siteId ?? null,
        site: (decrypted as any).site ?? null,
    });
}

// ── Capability Helpers (for backward compatibility) ───────────────────────────

export { buildCapabilitySet as detectRouterCapabilities } from "./versionCompatibility";
export { normalizeRouterVendor as detectVendor } from "./routerAdapters";
