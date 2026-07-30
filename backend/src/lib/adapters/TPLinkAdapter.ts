/**
 * TP-Link Business Router Adapter
 *
 * VENDOR-ADAPTER-008: HTTP API client for TP-Link Business Routers (ER series).
 *
 * Supports TP-Link ER605, ER7206, ER7212PC and similar business router models.
 * Uses the LuCI-based HTTP RPC API (token auth via /cgi-bin/luci path).
 *
 * Architecture:
 *   - Token-based auth: POST login → stok (session token) in URL path
 *   - RPC-style API: all calls go to /cgi-bin/luci/;stok=TOKEN/rpc/MODULE/METHOD
 *   - Token refreshed on 403 responses
 *
 * Security:
 *   - SSRF protection
 *   - Token stored in memory only
 *   - Per-command audit logging
 */

import logger from "@/lib/logger";
import { getTenantClient } from "@/lib/tenantPrisma";
import { validateOutboundHost } from "@/lib/mikrotik";
import { buildCapabilitySet } from "@/lib/versionCompatibility";
import type { RouterAdapter, RouterAdapterContext, RouterCapabilitySet } from "@/lib/routerAdapters";

function adapterVersionTag(v?: string | null) { return `TPLinkAdapter@${v ?? "unknown"}`; }

export class TPLinkAdapter implements RouterAdapter {
    readonly name = "TPLinkAdapter";
    readonly vendor = "tplink" as const;

    private context: RouterAdapterContext;
    private stok: string | null = null;
    private baseUrl: string;

    constructor(context: RouterAdapterContext) {
        this.context = context;
        const port = context.apiPort ?? context.port ?? 443;
        const protocol = "https";
        this.baseUrl = `${protocol}://${context.host}:${port}`;
    }

    private unsupported(feature: string, reason?: string) {
        return {
            success: false,
            message: reason ?? `${feature} is not supported via the TP-Link Business Router API.`,
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
        const url = `${this.baseUrl}/cgi-bin/luci/;stok=/rpc/xqsystem/login`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    method: "do",
                    login: {
                        username: this.context.username ?? "admin",
                        password: this.context.password ?? "",
                    },
                }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const data: any = await res.json().catch(() => ({}));
            if (data?.code !== 0 || !data?.stok) {
                throw new Error(
                    `TP-Link authentication failed (code ${data?.code}). ` +
                    `Check credentials and ensure HTTP API is enabled.`
                );
            }
            this.stok = data.stok;
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") throw new Error(`TP-Link router at ${this.context.host} timed out.`);
            throw err;
        }
    }

    private async ensureAuthenticated(): Promise<void> {
        if (!this.stok) await this.authenticate();
    }

    private async rpcRequest(module: string, method: string, params: Record<string, unknown> = {}): Promise<any> {
        validateOutboundHost(this.context.host ?? "");
        await this.ensureAuthenticated();

        const url = `${this.baseUrl}/cgi-bin/luci/;stok=${this.stok}/rpc/${module}/${method}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method: "do", ...params }),
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (res.status === 403) {
                // Token expired — re-auth and retry once
                this.stok = null;
                await this.authenticate();
                return this.rpcRequest(module, method, params);
            }

            const data: any = await res.json().catch(() => ({}));
            if (data?.code !== 0 && data?.code !== undefined) {
                throw new Error(`TP-Link RPC error (code ${data.code}): ${data.msg ?? "Unknown error"}`);
            }
            return data;
        } catch (err: any) {
            clearTimeout(timeout);
            if (err.name === "AbortError") throw new Error(`TP-Link RPC request to ${module}/${method} timed out.`);
            throw err;
        }
    }

    // ── RouterAdapter Interface ───────────────────────────────────────────────

    async connect(): Promise<{ success: boolean; message: string; data?: any; info?: any }> {
        const start = Date.now();
        try {
            await this.authenticate();
            const info = await this.rpcRequest("xqsystem", "get_basic_info");

            if (this.context.id) {
                const db = getTenantClient(null);
                await db.router.update({
                    where: { id: this.context.id },
                    data: { status: "ONLINE", lastSeen: new Date() },
                }).catch(() => { });
            }

            await this.log("connection_test", "Connected to TP-Link router", "success", {
                commandSent: "POST /cgi-bin/luci/.../xqsystem/login",
                durationMs: Date.now() - start,
            });

            return {
                success: true,
                message: "Connected to TP-Link Business Router",
                info: { vendor: "TP-Link", model: info?.model, firmware: info?.firmwareVersion },
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
        this.stok = null;
        return { success: true, message: "TP-Link session cleared" };
    }

    async healthCheck(): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const info = await this.rpcRequest("xqsystem", "get_basic_info");
            await this.log("health_check", "Health check passed", "success", {
                commandSent: "POST xqsystem/get_basic_info",
                durationMs: Date.now() - start,
            });
            return { success: true, message: "TP-Link router is healthy", data: info };
        } catch (err: any) {
            await this.log("health_check", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async monitor(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const [status, clients] = await Promise.all([
                this.rpcRequest("xqsystem", "get_basic_info").catch(() => ({})),
                this.rpcRequest("xqnetwork", "get_all_active_clients").catch(() => ({ clients: [] })),
            ]);
            const data = {
                firmwareVersion: status.firmwareVersion,
                model: status.model,
                activeClients: clients?.clients?.length ?? 0,
                clients: clients?.clients ?? [],
            };
            await this.log("monitor", `${data.activeClients} clients`, "success", {
                durationMs: Date.now() - start,
            });
            return { success: true, message: "TP-Link monitoring data collected", data };
        } catch (err: any) {
            return { success: false, message: err.message };
        }
    }

    async createDHCP(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            const result = await this.rpcRequest("xqnetwork", "set_lan_info", {
                lan: {
                    ip: payload.gateway ?? "192.168.1.1",
                    netmask: payload.netmask ?? "255.255.255.0",
                    dhcpEnabled: true,
                    dhcpStart: payload.dhcpStart ?? "192.168.1.100",
                    dhcpEnd: payload.dhcpEnd ?? "192.168.1.200",
                },
            });
            await this.log("create_dhcp", "DHCP configured", "success", {
                commandSent: "POST xqnetwork/set_lan_info",
                durationMs: Date.now() - start,
            });
            return { success: true, message: "DHCP configured on TP-Link", data: result };
        } catch (err: any) {
            await this.log("create_dhcp", err.message, "error", { durationMs: Date.now() - start });
            return { success: false, message: err.message };
        }
    }

    async reboot(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        const start = Date.now();
        try {
            await this.rpcRequest("xqsystem", "reboot");
            await this.log("reboot", "Reboot command sent", "success", {
                commandSent: "POST xqsystem/reboot",
                durationMs: Date.now() - start,
            });
            return { success: true, message: "TP-Link router reboot initiated" };
        } catch (err: any) {
            // Connection drops on reboot
            if (err.message?.includes("ECONNRESET") || err.message?.includes("timed out")) {
                return { success: true, message: "Reboot initiated" };
            }
            return { success: false, message: err.message };
        }
    }

    async createVLAN(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("VLAN management",
            "VLAN configuration on TP-Link Business routers requires direct web console access.");
    }

    async createFirewall(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Firewall rules",
            "Firewall rule management on TP-Link Business routers must be done via the web console.");
    }

    async backup(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Backup");
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
        return this.unsupported("PPPoE server");
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
        return this.unsupported("Direct API access");
    }
    async createVpnUser(payload?: any): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("VPN User");
    }
    async deleteVpnUser(username: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("VPN User deletion");
    }
    async disconnectSession(sessionId: string): Promise<{ success: boolean; message: string; data?: any }> {
        return this.unsupported("Session disconnect");
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
        let detectedVersion = this.context.firmwareVersion ?? "1.0";
        let detectedModel = this.context.model ?? "TP-Link";

        try {
            await this.authenticate();
            const info = await this.rpcRequest("xqsystem", "get_basic_info").catch(() => null);
            if (info?.firmwareVersion) detectedVersion = info.firmwareVersion;
            if (info?.model) detectedModel = info.model;
        } catch { /* use defaults */ }

        const capSet = buildCapabilitySet("tplink", detectedVersion);

        if (this.context.id) {
            const db = getTenantClient(null);
            await db.router.update({
                where: { id: this.context.id },
                data: {
                    firmwareVersion: detectedVersion,
                    model: detectedModel,
                    capabilities: capSet.capabilities,
                    supportedFeatures: capSet.supportedFeatures,
                    apiType: capSet.apiType,
                    lastDiscovery: new Date(),
                    healthStatus: "HEALTHY",
                },
            }).catch(() => { });
        }

        await this.log("discover_capabilities", `TP-Link ${detectedModel} v${detectedVersion}`, "success", {
            commandSent: "POST xqsystem/get_basic_info",
            durationMs: Date.now() - start,
        });

        return {
            vendor: "tplink",
            firmwareVersion: detectedVersion,
            architecture: null,
            apiType: capSet.apiType,
            supportedFeatures: capSet.supportedFeatures,
            capabilities: capSet.capabilities,
        };
    }
}
