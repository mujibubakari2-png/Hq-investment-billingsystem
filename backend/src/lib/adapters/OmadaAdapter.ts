/**
 * Omada Controller Adapter
 *
 * VENDOR-ADAPTER-006: Full HTTP client implementation for TP-Link Omada SDN Controller.
 *
 * Supports Omada Controller v5.0+ REST API.
 *
 * Architecture:
 *   - Session-based authentication (POST /api/v2/hotspot/login → session cookie)
 *   - CSRF token managed automatically per session
 *   - Site-aware API paths: all device operations scoped to a site ID
 *   - Graceful unsupported-feature responses for PPPoE/WireGuard/Hotspot
 *
 * Security:
 *   - Credentials never logged in plaintext
 *   - SSRF protection via validateOutboundHost()
 *   - Session cookies stored in memory only (not persisted)
 *   - Per-command audit logging
 */

import logger from "@/lib/logger";
import { getTenantClient } from "@/lib/tenantPrisma";
import { validateOutboundHost } from "@/lib/mikrotik";
import { buildCapabilitySet } from "@/lib/versionCompatibility";
import type { RouterAdapter, RouterAdapterContext, RouterCapabilitySet } from "@/lib/routerAdapters";

// ── Adapter Version Tag ───────────────────────────────────────────────────────
function adapterVersionTag(firmwareVersion?: string | null): string {
    return `OmadaAdapter@${firmwareVersion || "unknown"}`;
}

// ── Session State ─────────────────────────────────────────────────────────────
interface OmadaSession {
    token: string;          // CSRF token (Omada-Csrf-Token header)
    cookie: string;         // Session cookie string
    expiresAt: number;      // Unix ms — refresh if expired
    omadacId?: string;      // Omada controller ID (some versions require it)
}

// ── Omada Adapter ─────────────────────────────────────────────────────────────

export class OmadaAdapter implements RouterAdapter {
    readonly name = "OmadaAdapter";
    readonly vendor = "omada" as const;

    private context: RouterAdapterContext;
    private session: OmadaSession | null = null;
    private baseUrl: string;

    constructor(context: RouterAdapterContext) {
        this.context = context;
        const port = context.apiPort ?? context.port ?? 8043;
        const protocol = "https";
        this.baseUrl = `${protocol}://${context.host}:${port}`;
    }

    // ── Unsupported Feature Helper ────────────────────────────────────────────

    private unsupported(feature: string, reason?: string) {
        return {
            success: false,
            message: reason ??
                `${feature} is not supported by the Omada controller API. ` +
                `Configure this directly on the ER device or via the Omada web console.`,
        };
    }

    // ── Logging Helper ────────────────────────────────────────────────────────

    private async log(
        action: string,
        details?: string,
        status: "success" | "error" = "success",
        opts?: { commandSent?: string; responseReceived?: string; durationMs?: number }
    ): Promise<void> {
        if (!this.context.id) return;
        try {
            const db = getTenantClient(null);
            await db.routerLog.create({
                data: {
                    routerId: this.context.id,
                    action,
                    details: details?.slice(0, 500) ?? null,
                    status,
                    tenantId: this.context.tenantId ?? null,
                    commandSent: opts?.commandSent?.slice(0, 500) ?? null,
                    responseReceived: opts?.responseReceived?.slice(0, 2000) ?? null,
                    adapterVersion: adapterVersionTag(this.context.firmwareVersion),
                    durationMs: opts?.durationMs ?? null,
                },
            });
        } catch (e) {
            logger.error("[OmadaAdapter] Failed to write router log", { error: String(e) });
        }
    }

    // ── HTTP Client ───────────────────────────────────────────────────────────

    private async request(
        path: string,
        method = "GET",
        body?: unknown,
        skipAuth = false
    ): Promise<any> {
        validateOutboundHost(this.context.host ?? "");

        if (!skipAuth) await this.ensureAuthenticated();

        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.session?.token) headers["Csrf-Token"] = this.session.token;
        if (this.session?.cookie) headers["Cookie"] = this.session.cookie;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        try {
            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const text = await res.text();
            let parsed: any = {};
            try { parsed = JSON.parse(text); } catch { /* non-JSON response */ }

            if (!res.ok && res.status !== 200) {
                throw new Error(`Omada API error (${res.status}): ${text.slice(0, 200)}`);
            }

            // Omada wraps responses in { errorCode: 0, result: ... }
            if (parsed?.errorCode !== undefined && parsed.errorCode !== 0) {
                throw new Error(`Omada error ${parsed.errorCode}: ${parsed.msg ?? "Unknown error"}`);
            }

            return parsed?.result ?? parsed;
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") {
                throw new Error(`Connection to Omada controller at ${this.context.host} timed out.`);
            }
            throw err;
        }
    }

    // ── Session Management ────────────────────────────────────────────────────

    private async ensureAuthenticated(): Promise<void> {
        const now = Date.now();
        // Session valid for 1 hour (Omada default), refresh 5 min early
        if (this.session && this.session.expiresAt > now + 5 * 60 * 1000) return;
        await this.authenticate();
    }

    private async authenticate(): Promise<void> {
        const url = `${this.baseUrl}/api/v2/hotspot/login`;
        validateOutboundHost(this.context.host ?? "");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: this.context.username,
                    password: this.context.password,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const text = await res.text();
            let parsed: any = {};
            try { parsed = JSON.parse(text); } catch { /* ignore */ }

            if (!res.ok || (parsed?.errorCode !== undefined && parsed.errorCode !== 0)) {
                throw new Error(
                    `Omada authentication failed (${res.status}). ` +
                    `Check controller URL and credentials. Error: ${parsed?.msg ?? text.slice(0, 100)}`
                );
            }

            // Extract session cookie and CSRF token
            const setCookieHeader = res.headers.get("set-cookie") ?? "";
            const cookieParts = setCookieHeader.split(";").map(s => s.trim());
            const sessionCookie = cookieParts[0] ?? "";

            // Extract CSRF token from response body
            const csrfToken = parsed?.result?.token ?? parsed?.token ?? "";

            this.session = {
                token: csrfToken,
                cookie: sessionCookie,
                expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
                omadacId: parsed?.result?.omadacId,
            };

            logger.debug("[OmadaAdapter] Authenticated successfully", {
                host: this.context.host,
                hasToken: !!csrfToken,
            });
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") throw new Error(`Omada controller at ${this.context.host} timed out during login.`);
            throw err;
        }
    }

    // ── Utility: get site ID from context ────────────────────────────────────

    private get siteId(): string {
        // Stored in context as part of capabilities or model field
        return (this.context as any).siteId ?? "default";
    }

    // ── RouterAdapter Interface ───────────────────────────────────────────────

    async connect(): Promise<{ success: boolean; message: string; data?: any; info?: any }> {
        const start = Date.now();
        try {
            await this.authenticate();

            // Verify by listing sites
            const sites = await this.request("/api/v2/sites");

            await this.log("connection_test", "Connected to Omada controller", "success", {
                commandSent: "POST /api/v2/hotspot/login + GET /api/v2/sites",
                responseReceived: JSON.stringify(sites).slice(0, 300),
                durationMs: Date.now() - start,
            });

            // Update router status
            if (this.context.id) {
                const db = getTenantClient(null);
                await db.router.update({
                    where: { id: this.context.id },
                    data: { status: "ONLINE", lastSeen: new Date() },
                }).catch(() => { });
            }

            return {
                success: true,
                message: "Connected to Omada controller",
                info: { vendor: "Omada", sites: Array.isArray(sites) ? sites.length : 1 },
            };
        } catch (err: any) {
            if (this.context.id) {
                const db = getTenantClient(null);
                await db.router.update({
                    where: { id: this.context.id },
                    data: { status: "OFFLINE" },
                }).catch(() => { });
            }
            await this.log("connection_test", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async disconnect(): Promise<{ success: boolean; message: string }> {
        this.session = null;
        return { success: true, message: "Omada session cleared" };
    }

    async healthCheck(): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const stats = await this.request(`/api/v2/sites/${this.siteId}/dashboard/overallStat`);
            await this.log("health_check", "Health check passed", "success", {
                commandSent: `GET /api/v2/sites/${this.siteId}/dashboard/overallStat`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "Omada controller is healthy", data: stats };
        } catch (err: any) {
            await this.log("health_check", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async monitor(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const clients = await this.request(`/api/v2/sites/${this.siteId}/clients`);
            const devices = await this.request(`/api/v2/sites/${this.siteId}/devices`).catch(() => []);
            const data = {
                activeClients: Array.isArray(clients) ? clients.length : 0,
                devices: Array.isArray(devices) ? devices.length : 0,
                clients,
            };
            await this.log("monitor", `${data.activeClients} clients active`, "success", {
                commandSent: `GET /api/v2/sites/${this.siteId}/clients`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "Omada monitoring data collected", data };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }

    async createVLAN(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.request(
                `/api/v2/sites/${this.siteId}/setting/lan/networks`,
                "POST",
                {
                    name: payload.name,
                    purpose: "corporate",
                    vlan: payload.vlanId ?? 100,
                    gatewaySubnet: payload.subnet ?? "192.168.100.1/24",
                }
            );
            await this.log("create_vlan", `Created VLAN: ${payload.name}`, "success", {
                commandSent: `POST /api/v2/sites/${this.siteId}/setting/lan/networks`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "VLAN created on Omada controller", data: result };
        } catch (err: any) {
            await this.log("create_vlan", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async createDHCP(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.request(
                `/api/v2/sites/${this.siteId}/setting/lan/networks`,
                "POST",
                {
                    name: payload.name ?? "hq-dhcp",
                    purpose: "guest",
                    gatewaySubnet: payload.subnet ?? "192.168.88.1/24",
                    dhcpServer: true,
                }
            );
            await this.log("create_dhcp", `Created network/DHCP: ${payload.name}`, "success", {
                commandSent: `POST /api/v2/sites/${this.siteId}/setting/lan/networks`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "DHCP network configured on Omada", data: result };
        } catch (err: any) {
            await this.log("create_dhcp", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async createFirewall(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Firewall rule management",
            "Omada firewall rules must be configured via the Omada web console. API-level firewall management is only available on Omada SDN v5.9+ with Gateway devices.");
    }

    async createDNS(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("DNS configuration",
            "DNS settings on Omada are configured per-network in the LAN settings.");
    }

    async createBridge(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Bridge creation",
            "Omada manages switching/bridging via port profiles and VLANs, not explicit bridge creation.");
    }

    async backup(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Backup via API",
            "Omada backups must be triggered from the Omada web console (Settings → Maintenance → Backup).");
    }

    async restore(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Restore via API",
            "Omada restore must be performed via the Omada web console.");
    }

    async reboot(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            // Reboot specific device by MAC if provided, otherwise all gateway devices
            const result = await this.request(
                `/api/v2/sites/${this.siteId}/cmd/devices`,
                "POST",
                { cmd: "reboot", macs: payload?.mac ? [payload.mac] : [] }
            );
            await this.log("reboot", "Reboot command sent", "success", {
                commandSent: `POST /api/v2/sites/${this.siteId}/cmd/devices`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "Omada device reboot initiated", data: result };
        } catch (err: any) {
            await this.log("reboot", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    // ── Unsupported MikroTik-specific features ────────────────────────────────

    async createUser(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("User management", "Omada does not expose user/subscriber management via API.");
    }
    async deleteUser(username: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("User deletion");
    }
    async createPPPoE(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("PPPoE", "PPPoE server is not supported via the Omada controller API.");
    }
    async createHotspot(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Hotspot", "Omada uses controller-managed captive portal, not MikroTik-style Hotspot.");
    }
    async listPPPoEProfiles(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("PPPoE Profiles");
    }
    async listHotspotProfiles(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Hotspot Profiles");
    }
    async createPPPoEProfile(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("PPPoE Profiles");
    }
    async createHotspotProfile(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Hotspot Profiles");
    }
    async createQueue(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Queue management", "Bandwidth control on Omada is managed via QoS profiles in the Omada console.");
    }
    async apiRequestPublic(path: string, method = "GET", body?: any): Promise<any> {
        return this.request(path, method, body);
    }
    async createVpnUser(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("VPN User");
    }
    async deleteVpnUser(username: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("VPN User deletion");
    }
    async disconnectSession(sessionId: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Session disconnect", "Client disconnection on Omada must be done via the Omada web console.");
    }
    async createWireGuardPeer(peer: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("WireGuard", "WireGuard is not supported on Omada hardware.");
    }
    async deleteWireGuardPeer(key: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("WireGuard");
    }
    async pushHotspotSettings(settings: any): Promise<{ success: boolean; message?: string; data?: any }> {
        return this.unsupported("Hotspot Settings");
    }
    async createProfileFromPackage(): Promise<any> {
        return this.unsupported("Profile from Package");
    }

    // ── Capability Discovery ──────────────────────────────────────────────────

    async discoverCapabilities(): Promise<RouterCapabilitySet> {
        const start = Date.now();
        let detectedVersion = this.context.firmwareVersion ?? "5.0";

        try {
            await this.authenticate();
            // Try to get controller info
            const info = await this.request("/api/v2/maintenance/controllerSetting/info").catch(() => null);
            if (info?.version) detectedVersion = info.version;
        } catch (err) {
            logger.warn("[OmadaAdapter] Could not fetch controller version — using default", { error: String(err) });
        }

        const capSet = buildCapabilitySet("omada", detectedVersion);

        if (this.context.id) {
            const db = getTenantClient(null);
            await db.router.update({
                where: { id: this.context.id },
                data: {
                    firmwareVersion: detectedVersion,
                    capabilities: { ...capSet.capabilities, controllerApi: true },
                    supportedFeatures: capSet.supportedFeatures,
                    apiType: capSet.apiType,
                    lastDiscovery: new Date(),
                    healthStatus: "HEALTHY",
                },
            }).catch(() => { });
        }

        await this.log("discover_capabilities", `Omada controller v${detectedVersion}`, "success", {
            commandSent: "GET /api/v2/maintenance/controllerSetting/info",
            durationMs: Date.now() - start,
        });

        return {
            vendor: "omada",
            firmwareVersion: detectedVersion,
            architecture: null,
            apiType: capSet.apiType,
            supportedFeatures: capSet.supportedFeatures,
            capabilities: { ...capSet.capabilities, controllerApi: true },
        };
    }
}
