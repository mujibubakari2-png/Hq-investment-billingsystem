/**
 * MikroTik RouterOS API Integration Service
 * 
 * Provides PPPoE and Hotspot user management, bandwidth control,
 * active session monitoring, and remote disconnect capabilities.
 * 
 * Uses HTTP REST API (RouterOS v7+) or falls back to simulation mode.
 */

import prisma from "./prisma";

// ── Types ───────────────────────────────────────────────────────────────────

export interface MikroTikConnection {
    host: string;
    port: number;
    username: string;
    password: string;
}

export interface PPPoEUser {
    id?: string;
    name: string;
    password: string;
    service: string;
    profile: string;
    disabled: boolean;
    comment?: string;
}

export interface HotspotUser {
    id?: string;
    name: string;
    password: string;
    profile: string;
    server: string;
    disabled: boolean;
    comment?: string;
    macAddress?: string;
    limitUptime?: string;
    limitBytesTotal?: string;
}

export interface ActiveSession {
    id: string;
    user: string;
    address: string;
    uptime: string;
    bytesIn: string;
    bytesOut: string;
    service: string;
    callerId?: string;
}

export interface BandwidthProfile {
    id?: string;
    name: string;
    rateLimit: string; // e.g. "10M/20M" (upload/download)
    sharedUsers?: number;
    comment?: string;
}

export interface RouterSystemInfo {
    identity: string;
    version: string;
    cpuLoad: number;
    freeMemory: number;
    totalMemory: number;
    uptime: string;
    boardName: string;
    architecture: string;
}

// ── MikroTik API Service Class ──────────────────────────────────────────────

export class MikroTikService {
    private conn: MikroTikConnection;
    private routerId: string;
    private baseUrl: string;

    constructor(conn: MikroTikConnection, routerId: string) {
        this.conn = conn;
        this.routerId = routerId;
        // RouterOS REST API runs on the HTTP port (default 80), NOT the API port (8728)
        // The apiPort (8728) is for the RouterOS terminal API protocol
        // For REST: use port 80 (http) or 443 (https)
        const restPort = conn.port === 8728 || conn.port === 8729 ? 80 : conn.port;
        this.baseUrl = `http://${conn.host}:${restPort}`;
    }

    // ── Internal HTTP helper for RouterOS REST API ───────────────────────────

    private async apiRequest(path: string, method: string = "GET", body?: unknown): Promise<any> {
        const url = `${this.baseUrl}/rest${path}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Authorization": "Basic " + Buffer.from(`${this.conn.username}:${this.conn.password}`).toString("base64"),
        };

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`RouterOS API error (${res.status}): ${errText}`);
            }

            const text = await res.text();
            return text ? JSON.parse(text) : {};
        } catch (err: any) {
            if (err.name === "AbortError") {
                throw new Error(`Connection to ${this.conn.host} timed out after 8 seconds. Ensure the router is reachable and REST API is enabled on the web port (80/443).`);
            }
            if (err.cause?.code === "ECONNREFUSED") {
                throw new Error(`Connection refused by ${this.conn.host}. Ensure the router is reachable and the REST API (www-ssl or www) service is enabled.`);
            }
            if (err.cause?.code === "EHOSTUNREACH" || err.cause?.code === "ENETUNREACH") {
                throw new Error(`Router ${this.conn.host} is unreachable. Check the IP address and network connectivity.`);
            }
            throw new Error(`Failed to connect to ${this.conn.host}: ${err.message}`);
        }
    }

    // ── Log helper ──────────────────────────────────────────────────────────

    private async log(action: string, details?: string, status: string = "success", username?: string) {
        try {
            await prisma.routerLog.create({
                data: {
                    routerId: this.routerId,
                    action,
                    details,
                    status,
                    username,
                },
            });
        } catch (e) {
            console.error("Failed to create router log:", e);
        }
    }

    // ── Public API Request (for advanced operations like WireGuard push) ───

    async apiRequestPublic(path: string, method: string = "GET", body?: unknown): Promise<any> {
        return this.apiRequest(path, method, body);
    }

    // ── Connection Test ─────────────────────────────────────────────────────

    async testConnection(): Promise<{ success: boolean; message: string; info?: RouterSystemInfo }> {
        try {
            const identity = await this.apiRequest("/system/identity");
            const resources = await this.apiRequest("/system/resource");

            const res = Array.isArray(resources) ? resources[0] : resources;
            const ident = Array.isArray(identity) ? identity[0] : identity;

            const info: RouterSystemInfo = {
                identity: ident?.name || "Unknown",
                version: res?.version || "Unknown",
                cpuLoad: parseInt(res?.["cpu-load"] || "0"),
                freeMemory: parseInt(res?.["free-memory"] || "0"),
                totalMemory: parseInt(res?.["total-memory"] || "0"),
                uptime: res?.uptime || "0s",
                boardName: res?.["board-name"] || "Unknown",
                architecture: res?.["architecture-name"] || "Unknown",
            };

            // Update router status in DB
            await prisma.router.update({
                where: { id: this.routerId },
                data: {
                    status: "ONLINE",
                    cpuLoad: info.cpuLoad,
                    memoryUsed: info.totalMemory > 0
                        ? Math.round((1 - info.freeMemory / info.totalMemory) * 100)
                        : 0,
                    uptime: info.uptime,
                    lastSeen: new Date().toISOString(),
                },
            });

            await this.log("connection_test", `Connected successfully. RouterOS ${info.version}`, "success");
            return { success: true, message: "Connected successfully", info };
        } catch (err: any) {
            await prisma.router.update({
                where: { id: this.routerId },
                data: { status: "OFFLINE" },
            });
            await this.log("connection_test", err.message, "error");
            return { success: false, message: err.message };
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PPPoE USER MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    async listPPPoEUsers(): Promise<PPPoEUser[]> {
        try {
            const users = await this.apiRequest("/ppp/secret");
            return (users || []).map((u: any) => ({
                id: u[".id"],
                name: u.name,
                password: u.password || "***",
                service: u.service || "pppoe",
                profile: u.profile || "default",
                disabled: u.disabled === "true" || u.disabled === true,
                comment: u.comment || "",
            }));
        } catch (err: any) {
            await this.log("list_pppoe_users", err.message, "error");
            throw err;
        }
    }

    async createPPPoEUser(user: Omit<PPPoEUser, "id">): Promise<PPPoEUser> {
        try {
            const result = await this.apiRequest("/ppp/secret", "PUT", {
                name: user.name,
                password: user.password,
                service: user.service || "pppoe",
                profile: user.profile || "default",
                disabled: user.disabled ? "true" : "false",
                comment: user.comment || `Managed by Kenge ISP Billing`,
            });

            await this.log("create_pppoe_user", `Created PPPoE user: ${user.name}`, "success", user.name);
            return { ...user, id: result?.[".id"] || result?.ret };
        } catch (err: any) {
            await this.log("create_pppoe_user", `Failed to create PPPoE user ${user.name}: ${err.message}`, "error", user.name);
            throw err;
        }
    }

    async updatePPPoEUser(userId: string, data: Partial<PPPoEUser>): Promise<void> {
        try {
            const payload: any = { ".id": userId };
            if (data.password) payload.password = data.password;
            if (data.profile) payload.profile = data.profile;
            if (data.disabled !== undefined) payload.disabled = data.disabled ? "true" : "false";
            if (data.comment) payload.comment = data.comment;

            await this.apiRequest("/ppp/secret", "PATCH", payload);

            const action = data.disabled === true ? "disable_pppoe_user" : data.disabled === false ? "enable_pppoe_user" : "update_pppoe_user";
            await this.log(action, `Updated PPPoE user ${userId}`, "success", data.name);
        } catch (err: any) {
            await this.log("update_pppoe_user", `Failed: ${err.message}`, "error");
            throw err;
        }
    }

    async deletePPPoEUser(userId: string, username?: string): Promise<void> {
        try {
            await this.apiRequest(`/ppp/secret/${userId}`, "DELETE");
            await this.log("delete_pppoe_user", `Deleted PPPoE user: ${username || userId}`, "success", username);
        } catch (err: any) {
            await this.log("delete_pppoe_user", `Failed: ${err.message}`, "error", username);
            throw err;
        }
    }

    async enablePPPoEUser(userId: string, username?: string): Promise<void> {
        await this.updatePPPoEUser(userId, { disabled: false, name: username });
    }

    async disablePPPoEUser(userId: string, username?: string): Promise<void> {
        await this.updatePPPoEUser(userId, { disabled: true, name: username });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HOTSPOT USER MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════════

    async listHotspotUsers(): Promise<HotspotUser[]> {
        try {
            const users = await this.apiRequest("/ip/hotspot/user");
            return (users || []).map((u: any) => ({
                id: u[".id"],
                name: u.name,
                password: u.password || "***",
                profile: u.profile || "default",
                server: u.server || "all",
                disabled: u.disabled === "true" || u.disabled === true,
                comment: u.comment || "",
                macAddress: u["mac-address"] || "",
                limitUptime: u["limit-uptime"] || "",
                limitBytesTotal: u["limit-bytes-total"] || "",
            }));
        } catch (err: any) {
            await this.log("list_hotspot_users", err.message, "error");
            throw err;
        }
    }

    async createHotspotUser(user: Omit<HotspotUser, "id">): Promise<HotspotUser> {
        try {
            const payload: any = {
                name: user.name,
                password: user.password,
                profile: user.profile || "default",
                server: user.server || "all",
                disabled: user.disabled ? "true" : "false",
                comment: user.comment || `Managed by Kenge ISP Billing`,
            };
            if (user.macAddress) payload["mac-address"] = user.macAddress;
            if (user.limitUptime) payload["limit-uptime"] = user.limitUptime;
            if (user.limitBytesTotal) payload["limit-bytes-total"] = user.limitBytesTotal;

            const result = await this.apiRequest("/ip/hotspot/user", "PUT", payload);
            await this.log("create_hotspot_user", `Created Hotspot user: ${user.name}`, "success", user.name);
            return { ...user, id: result?.[".id"] || result?.ret };
        } catch (err: any) {
            await this.log("create_hotspot_user", `Failed: ${err.message}`, "error", user.name);
            throw err;
        }
    }

    async updateHotspotUser(userId: string, data: Partial<HotspotUser>): Promise<void> {
        try {
            const payload: any = { ".id": userId };
            if (data.password) payload.password = data.password;
            if (data.profile) payload.profile = data.profile;
            if (data.disabled !== undefined) payload.disabled = data.disabled ? "true" : "false";
            if (data.comment) payload.comment = data.comment;
            if (data.macAddress) payload["mac-address"] = data.macAddress;

            await this.apiRequest("/ip/hotspot/user", "PATCH", payload);

            const action = data.disabled === true ? "disable_hotspot_user" : data.disabled === false ? "enable_hotspot_user" : "update_hotspot_user";
            await this.log(action, `Updated Hotspot user ${userId}`, "success", data.name);
        } catch (err: any) {
            await this.log("update_hotspot_user", `Failed: ${err.message}`, "error");
            throw err;
        }
    }

    async deleteHotspotUser(userId: string, username?: string): Promise<void> {
        try {
            await this.apiRequest(`/ip/hotspot/user/${userId}`, "DELETE");
            await this.log("delete_hotspot_user", `Deleted Hotspot user: ${username || userId}`, "success", username);
        } catch (err: any) {
            await this.log("delete_hotspot_user", `Failed: ${err.message}`, "error", username);
            throw err;
        }
    }

    async enableHotspotUser(userId: string, username?: string): Promise<void> {
        await this.updateHotspotUser(userId, { disabled: false, name: username });
    }

    async disableHotspotUser(userId: string, username?: string): Promise<void> {
        await this.updateHotspotUser(userId, { disabled: true, name: username });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACTIVE SESSIONS
    // ══════════════════════════════════════════════════════════════════════════

    async listPPPoEActiveSessions(): Promise<ActiveSession[]> {
        try {
            const sessions = await this.apiRequest("/ppp/active");
            return (sessions || []).map((s: any) => ({
                id: s[".id"],
                user: s.name || "",
                address: s.address || "",
                uptime: s.uptime || "0s",
                bytesIn: s["bytes-in"] || "0",
                bytesOut: s["bytes-out"] || "0",
                service: "pppoe",
                callerId: s["caller-id"] || "",
            }));
        } catch (err: any) {
            await this.log("list_pppoe_sessions", err.message, "error");
            throw err;
        }
    }

    async listHotspotActiveSessions(): Promise<ActiveSession[]> {
        try {
            const sessions = await this.apiRequest("/ip/hotspot/active");
            return (sessions || []).map((s: any) => ({
                id: s[".id"],
                user: s.user || "",
                address: s.address || "",
                uptime: s.uptime || "0s",
                bytesIn: s["bytes-in"] || "0",
                bytesOut: s["bytes-out"] || "0",
                service: "hotspot",
                callerId: s["mac-address"] || "",
            }));
        } catch (err: any) {
            await this.log("list_hotspot_sessions", err.message, "error");
            throw err;
        }
    }

    async listAllActiveSessions(): Promise<ActiveSession[]> {
        const [pppoe, hotspot] = await Promise.allSettled([
            this.listPPPoEActiveSessions(),
            this.listHotspotActiveSessions(),
        ]);

        const sessions: ActiveSession[] = [];
        if (pppoe.status === "fulfilled") sessions.push(...pppoe.value);
        if (hotspot.status === "fulfilled") sessions.push(...hotspot.value);

        // Update active user count
        await prisma.router.update({
            where: { id: this.routerId },
            data: { activeUsers: sessions.length },
        });

        return sessions;
    }

    async disconnectPPPoESession(sessionId: string, username?: string): Promise<void> {
        try {
            await this.apiRequest(`/ppp/active/${sessionId}`, "DELETE");
            await this.log("disconnect_pppoe", `Disconnected PPPoE session: ${username || sessionId}`, "success", username);
        } catch (err: any) {
            await this.log("disconnect_pppoe", `Failed: ${err.message}`, "error", username);
            throw err;
        }
    }

    async disconnectHotspotSession(sessionId: string, username?: string): Promise<void> {
        try {
            await this.apiRequest(`/ip/hotspot/active/${sessionId}`, "DELETE");
            await this.log("disconnect_hotspot", `Disconnected Hotspot session: ${username || sessionId}`, "success", username);
        } catch (err: any) {
            await this.log("disconnect_hotspot", `Failed: ${err.message}`, "error", username);
            throw err;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BANDWIDTH PROFILES
    // ══════════════════════════════════════════════════════════════════════════

    async listPPPoEProfiles(): Promise<BandwidthProfile[]> {
        try {
            const profiles = await this.apiRequest("/ppp/profile");
            return (profiles || []).map((p: any) => ({
                id: p[".id"],
                name: p.name,
                rateLimit: p["rate-limit"] || "0/0",
                comment: p.comment || "",
            }));
        } catch (err: any) {
            await this.log("list_pppoe_profiles", err.message, "error");
            throw err;
        }
    }

    async listHotspotProfiles(): Promise<BandwidthProfile[]> {
        try {
            const profiles = await this.apiRequest("/ip/hotspot/user/profile");
            return (profiles || []).map((p: any) => ({
                id: p[".id"],
                name: p.name,
                rateLimit: p["rate-limit"] || "0/0",
                sharedUsers: parseInt(p["shared-users"] || "1"),
                comment: p.comment || "",
            }));
        } catch (err: any) {
            await this.log("list_hotspot_profiles", err.message, "error");
            throw err;
        }
    }

    async createPPPoEProfile(profile: Omit<BandwidthProfile, "id">): Promise<BandwidthProfile> {
        try {
            const result = await this.apiRequest("/ppp/profile", "PUT", {
                name: profile.name,
                "rate-limit": profile.rateLimit,
                comment: profile.comment || `Kenge ISP - ${profile.name}`,
            });
            await this.log("create_pppoe_profile", `Created PPPoE profile: ${profile.name} (${profile.rateLimit})`, "success");
            return { ...profile, id: result?.[".id"] || result?.ret };
        } catch (err: any) {
            await this.log("create_pppoe_profile", `Failed: ${err.message}`, "error");
            throw err;
        }
    }

    async createHotspotProfile(profile: Omit<BandwidthProfile, "id">): Promise<BandwidthProfile> {
        try {
            const result = await this.apiRequest("/ip/hotspot/user/profile", "PUT", {
                name: profile.name,
                "rate-limit": profile.rateLimit,
                "shared-users": String(profile.sharedUsers || 1),
                comment: profile.comment || `Kenge ISP - ${profile.name}`,
            });
            await this.log("create_hotspot_profile", `Created Hotspot profile: ${profile.name} (${profile.rateLimit})`, "success");
            return { ...profile, id: result?.[".id"] || result?.ret };
        } catch (err: any) {
            await this.log("create_hotspot_profile", `Failed: ${err.message}`, "error");
            throw err;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AUTOMATION HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Activate a customer's service after payment
     */
    async activateService(username: string, password: string, profileName: string, serviceType: "pppoe" | "hotspot"): Promise<void> {
        if (serviceType === "pppoe") {
            // Try to find existing user first
            const users = await this.listPPPoEUsers();
            const existing = users.find(u => u.name === username);

            if (existing && existing.id) {
                await this.enablePPPoEUser(existing.id, username);
            } else {
                await this.createPPPoEUser({
                    name: username,
                    password,
                    service: "pppoe",
                    profile: profileName,
                    disabled: false,
                });
            }
        } else {
            const users = await this.listHotspotUsers();
            const existing = users.find(u => u.name === username);

            if (existing && existing.id) {
                await this.enableHotspotUser(existing.id, username);
            } else {
                await this.createHotspotUser({
                    name: username,
                    password,
                    profile: profileName,
                    server: "all",
                    disabled: false,
                });
            }
        }
        await this.log("activate_service", `Activated ${serviceType} service for ${username}`, "success", username);
    }

    /**
     * Suspend a customer's service (expired subscription)
     */
    async suspendService(username: string, serviceType: "pppoe" | "hotspot"): Promise<void> {
        try {
            if (serviceType === "pppoe") {
                const users = await this.listPPPoEUsers();
                const user = users.find(u => u.name === username);
                if (user?.id) {
                    await this.disablePPPoEUser(user.id, username);
                    // Also disconnect active session
                    const sessions = await this.listPPPoEActiveSessions();
                    const session = sessions.find(s => s.user === username);
                    if (session) await this.disconnectPPPoESession(session.id, username);
                }
            } else {
                const users = await this.listHotspotUsers();
                const user = users.find(u => u.name === username);
                if (user?.id) {
                    await this.disableHotspotUser(user.id, username);
                    const sessions = await this.listHotspotActiveSessions();
                    const session = sessions.find(s => s.user === username);
                    if (session) await this.disconnectHotspotSession(session.id, username);
                }
            }
            await this.log("suspend_service", `Suspended ${serviceType} service for ${username}`, "success", username);
        } catch (err: any) {
            await this.log("suspend_service", `Failed to suspend service for ${username}: ${err.message}`, "error", username);
            throw err;
        }
    }

    /**
     * Create bandwidth profile from a package definition
     */
    async createProfileFromPackage(
        packageName: string,
        uploadSpeed: number,
        uploadUnit: string,
        downloadSpeed: number,
        downloadUnit: string,
        serviceType: "pppoe" | "hotspot",
        sharedUsers: number = 1,
    ): Promise<BandwidthProfile> {
        const uploadStr = `${uploadSpeed}${uploadUnit === "Mbps" ? "M" : uploadUnit === "Kbps" ? "k" : ""}`;
        const downloadStr = `${downloadSpeed}${downloadUnit === "Mbps" ? "M" : downloadUnit === "Kbps" ? "k" : ""}`;
        const rateLimit = `${uploadStr}/${downloadStr}`;

        if (serviceType === "pppoe") {
            return this.createPPPoEProfile({ name: packageName, rateLimit, comment: `Auto-created from package` });
        } else {
            return this.createHotspotProfile({ name: packageName, rateLimit, sharedUsers, comment: `Auto-created from package` });
        }
    }
}

// ── Factory Function ────────────────────────────────────────────────────────

export async function getMikroTikService(routerId: string): Promise<MikroTikService> {
    const router = await prisma.router.findUnique({ where: { id: routerId } });
    if (!router) throw new Error("Router not found");

    return new MikroTikService(
        {
            host: router.host,
            port: router.apiPort || router.port || 8728,
            username: router.username || "admin",
            password: router.password || "",
        },
        routerId,
    );
}
