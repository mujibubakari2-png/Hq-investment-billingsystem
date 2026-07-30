/**
 * UniFi Network Application Adapter
 *
 * VENDOR-ADAPTER-007: Full HTTP client for Ubiquiti UniFi Network Application.
 *
 * Supports UniFi Network Application v7.0+.
 *
 * Architecture:
 *   - Cookie-based auth: POST /api/auth/login → session cookie
 *   - Site-scoped API paths: /api/s/{site}/...
 *   - Supports client management, VLAN, firewall, and monitoring
 *   - Graceful unsupported responses for PPPoE/WireGuard/Hotspot
 *
 * Security:
 *   - validateOutboundHost() SSRF guard on every request
 *   - Session cookies stored in memory only
 *   - Per-command audit logging
 */

import logger from "@/lib/logger";
import { getTenantClient } from "@/lib/tenantPrisma";
import { validateOutboundHost } from "@/lib/mikrotik";
import { buildCapabilitySet } from "@/lib/versionCompatibility";
import type { RouterAdapter, RouterAdapterContext, RouterCapabilitySet } from "@/lib/routerAdapters";

function adapterVersionTag(v?: string | null) { return `UniFiAdapter@${v ?? "unknown"}`; }

// ── Session State ─────────────────────────────────────────────────────────────
interface UniFiSession {
    cookie: string;
    csrfToken: string;
    expiresAt: number;
}

export class UniFiAdapter implements RouterAdapter {
    readonly name = "UniFiAdapter";
    readonly vendor = "unifi" as const;

    private context: RouterAdapterContext;
    private session: UniFiSession | null = null;
    private baseUrl: string;

    constructor(context: RouterAdapterContext) {
        this.context = context;
        const port = context.apiPort ?? context.port ?? 443;
        this.baseUrl = `https://${context.host}:${port}`;
    }

    private get site(): string { return (this.context as any).site ?? "default"; }

    private unsupported(feature: string, reason?: string) {
        return {
            success: false,
            message: reason ??
                `${feature} is not supported by the UniFi Network Application API. ` +
                `Configure this via the UniFi web console.`,
        };
    }

    private async log(
        action: string,
        details?: string,
        status: "success" | "error" = "success",
        opts?: { commandSent?: string; responseReceived?: string; durationMs?: number }
    ) {
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
        } catch { /* non-fatal */ }
    }

    private async authenticate(): Promise<void> {
        validateOutboundHost(this.context.host ?? "");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const res = await fetch(`${this.baseUrl}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: this.context.username,
                    password: this.context.password,
                    remember: false,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!res.ok) {
                throw new Error(
                    `UniFi authentication failed (${res.status}). ` +
                    `Check controller URL (should be https://host:443) and credentials.`
                );
            }

            const setCookieHeader = res.headers.get("set-cookie") ?? "";
            const cookie = setCookieHeader.split(";")[0] ?? "";
            const csrfToken = res.headers.get("x-csrf-token") ?? "";

            this.session = {
                cookie,
                csrfToken,
                expiresAt: Date.now() + 60 * 60 * 1000,
            };
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") throw new Error(`UniFi controller at ${this.context.host} timed out.`);
            throw err;
        }
    }

    private async ensureAuthenticated(): Promise<void> {
        const now = Date.now();
        if (this.session && this.session.expiresAt > now + 5 * 60 * 1000) return;
        await this.authenticate();
    }

    private async request(path: string, method = "GET", body?: unknown): Promise<any> {
        validateOutboundHost(this.context.host ?? "");
        await this.ensureAuthenticated();

        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.session?.cookie) headers["Cookie"] = this.session.cookie;
        if (this.session?.csrfToken) headers["x-csrf-token"] = this.session.csrfToken;

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

            // Update CSRF token if returned
            const newCsrf = res.headers.get("x-csrf-token");
            if (newCsrf && this.session) this.session.csrfToken = newCsrf;

            const text = await res.text();
            let parsed: any = {};
            try { parsed = JSON.parse(text); } catch { /* ignore */ }

            if (!res.ok) throw new Error(`UniFi API error (${res.status}): ${text.slice(0, 200)}`);

            return parsed?.data ?? parsed;
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") throw new Error(`UniFi request to ${path} timed out.`);
            throw err;
        }
    }

    // ── RouterAdapter Interface ───────────────────────────────────────────────

    async connect(): Promise<{ success: boolean; message: string; data?: any; info?: any }> {
        const start = Date.now();
        try {
            await this.authenticate();
            const sites = await this.request("/api/self/sites");
            const health = await this.request(`/api/s/${this.site}/stat/health`).catch(() => []);

            if (this.context.id) {
                const db = getTenantClient(null);
                await db.router.update({
                    where: { id: this.context.id },
                    data: { status: "ONLINE", lastSeen: new Date() },
                }).catch(() => { });
            }

            await this.log("connection_test", "Connected to UniFi controller", "success", {
                commandSent: "POST /api/auth/login + GET /api/self/sites",
                durationMs: Date.now() - start,
            });

            return {
                success: true,
                message: "Connected to UniFi Network Application",
                info: { vendor: "UniFi", sites: Array.isArray(sites) ? sites.length : 1 },
            };
        } catch (err: any) {
            if (this.context.id) {
                const db = getTenantClient(null);
                await db.router.update({ where: { id: this.context.id }, data: { status: "OFFLINE" } }).catch(() => { });
            }
            await this.log("connection_test", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async disconnect(): Promise<{ success: boolean; message: string }> {
        try {
            await this.request("/api/auth/logout", "POST");
        } catch { /* ignore logout errors */ }
        this.session = null;
        return { success: true, message: "UniFi session logged out" };
    }

    async healthCheck(): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const health = await this.request(`/api/s/${this.site}/stat/health`);
            await this.log("health_check", "Health check passed", "success", {
                commandSent: `GET /api/s/${this.site}/stat/health`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "UniFi controller is healthy", data: health };
        } catch (err: any) {
            await this.log("health_check", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async monitor(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const [clients, devices] = await Promise.all([
                this.request(`/api/s/${this.site}/stat/sta`).catch(() => []),
                this.request(`/api/s/${this.site}/stat/device`).catch(() => []),
            ]);
            const data = {
                activeClients: Array.isArray(clients) ? clients.length : 0,
                devices: Array.isArray(devices) ? devices.length : 0,
                clients,
            };
            await this.log("monitor", `${data.activeClients} clients active`, "success", {
                commandSent: `GET /api/s/${this.site}/stat/sta`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "UniFi monitoring data collected", data };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }

    async createVLAN(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.request(`/api/s/${this.site}/rest/networkconf`, "POST", {
                name: payload.name,
                purpose: "corporate",
                ip_subnet: payload.subnet ?? "192.168.100.1/24",
                vlan: payload.vlanId ?? 100,
                dhcpd_enabled: true,
            });
            await this.log("create_vlan", `Created VLAN: ${payload.name}`, "success", {
                commandSent: `POST /api/s/${this.site}/rest/networkconf`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "VLAN created on UniFi", data: result };
        } catch (err: any) {
            await this.log("create_vlan", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async createDHCP(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.request(`/api/s/${this.site}/rest/networkconf`, "POST", {
                name: payload.name ?? "hq-dhcp",
                purpose: "corporate",
                ip_subnet: payload.subnet ?? "192.168.88.1/24",
                dhcpd_enabled: true,
                dhcpd_start: payload.dhcpStart ?? "192.168.88.100",
                dhcpd_stop: payload.dhcpStop ?? "192.168.88.254",
            });
            await this.log("create_dhcp", `Created DHCP network: ${payload.name}`, "success", {
                commandSent: `POST /api/s/${this.site}/rest/networkconf`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "DHCP network created on UniFi", data: result };
        } catch (err: any) {
            await this.log("create_dhcp", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async createFirewall(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.request(`/api/s/${this.site}/rest/firewallrule`, "POST", {
                name: payload.name ?? "hq-rule",
                ruleset: payload.chain === "forward" ? "LAN_IN" : "WAN_IN",
                action: payload.action === "accept" ? "accept" : "drop",
                protocol: payload.protocol ?? "all",
                enabled: true,
            });
            await this.log("create_firewall", `Created firewall rule: ${payload.name}`, "success", {
                commandSent: `POST /api/s/${this.site}/rest/firewallrule`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "Firewall rule created on UniFi", data: result };
        } catch (err: any) {
            await this.log("create_firewall", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async reboot(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.request(`/api/s/${this.site}/cmd/devmgr`, "POST", {
                cmd: "restart",
                mac: payload?.mac ?? "",
            });
            await this.log("reboot", "Reboot command sent", "success", {
                commandSent: `POST /api/s/${this.site}/cmd/devmgr`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: "UniFi device reboot initiated", data: result };
        } catch (err: any) {
            await this.log("reboot", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async backup(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Backup", "UniFi backups must be triggered via the UniFi Network Application web console.");
    }
    async restore(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Restore");
    }
    async createUser(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("User management");
    }
    async deleteUser(username: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("User deletion");
    }
    async createPPPoE(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("PPPoE");
    }
    async createHotspot(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Hotspot");
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
        return this.unsupported("Queue management");
    }
    async createDNS(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("DNS configuration");
    }
    async createBridge(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Bridge creation");
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
        const start = Date.now();
        try {
            const result = await this.request(`/api/s/${this.site}/cmd/stamgr`, "POST", {
                cmd: "kick-sta",
                mac: sessionId,
            });
            await this.log("disconnect_session", `Disconnected client: ${sessionId}`, "success", {
                commandSent: `POST /api/s/${this.site}/cmd/stamgr`,
                durationMs: Date.now() - start,
            });
            return { success: true, message: `Client ${sessionId} disconnected`, data: result };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }
    async createWireGuardPeer(peer: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("WireGuard");
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

    async discoverCapabilities(): Promise<RouterCapabilitySet> {
        const start = Date.now();
        let detectedVersion = this.context.firmwareVersion ?? "7.0";

        try {
            await this.authenticate();
            const sysInfo = await this.request("/api/s/default/stat/sysinfo").catch(() => null);
            if (sysInfo?.version) detectedVersion = sysInfo.version;
        } catch { /* use default */ }

        const capSet = buildCapabilitySet("unifi", detectedVersion);

        if (this.context.id) {
            const db = getTenantClient(null);
            await db.router.update({
                where: { id: this.context.id },
                data: {
                    firmwareVersion: detectedVersion,
                    capabilities: capSet.capabilities,
                    supportedFeatures: capSet.supportedFeatures,
                    apiType: capSet.apiType,
                    lastDiscovery: new Date(),
                    healthStatus: "HEALTHY",
                },
            }).catch(() => { });
        }

        await this.log("discover_capabilities", `UniFi v${detectedVersion}`, "success", {
            commandSent: "GET /api/s/default/stat/sysinfo",
            durationMs: Date.now() - start,
        });

        return {
            vendor: "unifi",
            firmwareVersion: detectedVersion,
            architecture: null,
            apiType: capSet.apiType,
            supportedFeatures: capSet.supportedFeatures,
            capabilities: capSet.capabilities,
        };
    }
}
