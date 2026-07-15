/**
 * MikroTik RouterOS API Integration Service
 * 
 * Provides PPPoE and Hotspot user management, bandwidth control,
 * active session monitoring, and remote disconnect capabilities.
 * 
 * Uses HTTP REST API (RouterOS v7+) or falls back to simulation mode.
 */

import https from "https";
import { isIPv4 } from "net";
import { env } from "@/lib/env";
import { getTenantClient } from "./tenantPrisma";
import { decryptRouterFields } from "./encryption";
import logger from "@/lib/logger";

// ── SSRF Guard ────────────────────────────────────────────────────────────────
// HIGH-SEC FIX: Prevent server-side request forgery via malicious router `host`.
// A compromised or injected router record could otherwise make the server hit
// AWS/GCP metadata endpoints (169.254.169.254), internal APIs, or loopback.
//
// MIKROTIK_ALLOW_PRIVATE=true bypasses private-range blocking for dev/VPN
// environments where routers sit on RFC1918 addresses (e.g. WireGuard tunnels).

const LOOPBACK_RE      = /^(127\.|0\.0\.0\.0|::1$|localhost$)/i;
const LINK_LOCAL_RE    = /^169\.254\./;          // AWS/GCP/Azure metadata
const PRIVATE_RE       = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;
const IPV6_SPECIAL_RE  = /^(fc|fd|fe80)/i;       // ULA + link-local IPv6

interface ValidateOutboundHostOptions {
    allowPrivate?: boolean;
}

export function validateOutboundHost(host: string, options?: ValidateOutboundHostOptions): void {
    const h = host.trim().toLowerCase();

    if (LOOPBACK_RE.test(h)) {
        throw new Error(`[SSRF] Blocked outbound request to loopback address: ${host}`);
    }
    if (LINK_LOCAL_RE.test(h)) {
        throw new Error(`[SSRF] Blocked outbound request to link-local address (metadata service): ${host}`);
    }
    if (IPV6_SPECIAL_RE.test(h)) {
        throw new Error(`[SSRF] Blocked outbound request to IPv6 special address: ${host}`);
    }

    // Private ranges are only allowed when explicitly permitted, such as for
    // routers that are already configured to use a WireGuard tunnel IP.
    const allowPrivate = options?.allowPrivate ?? process.env.MIKROTIK_ALLOW_PRIVATE === 'true';
    if (!allowPrivate && PRIVATE_RE.test(h)) {
        throw new Error(
            `[SSRF] Blocked outbound request to private IP ${host}. ` +
            `If routers are on a VPN/LAN, set MIKROTIK_ALLOW_PRIVATE=true or configure the router to use WireGuard.`
        );
    }
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface MikroTikConnection {
    host: string;
    port: number;
    username: string;
    password: string;
    /** Optional dedicated REST API port. If not set, port 8728/8729 is auto-mapped to 80/443. */
    restPort?: number;
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

// ── Input Validation Helpers ─────────────────────────────────────────────

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
const MAX_USERNAME_LENGTH = 50;
const MAX_PASSWORD_LENGTH = 100;
const MAX_COMMENT_LENGTH = 255;

function validateUsername(username: string): void {
    if (!username || username.trim().length === 0) {
        throw new Error("Username is required");
    }
    if (username.length > MAX_USERNAME_LENGTH) {
        throw new Error(`Username must not exceed ${MAX_USERNAME_LENGTH} characters`);
    }
    if (!USERNAME_REGEX.test(username)) {
        throw new Error("Username can only contain letters, numbers, underscores, dots, and hyphens");
    }
}

function validatePassword(password: string): void {
    if (!password || password.length === 0) {
        throw new Error("Password is required");
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
        throw new Error(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
    }
}

function sanitizeComment(comment: string): string {
    // Remove any characters that could break RouterOS scripts
    return comment.replace(/[;|&$`\{}[\]]/g, "").substring(0, MAX_COMMENT_LENGTH);
}

/**
 * Sanitizes a name for MikroTik usage (Profiles, Users, etc.)
 * Removes leading/trailing punctuation, replaces spaces with hyphens,
 * removes all other special characters, collapses multiple dashes,
 * and trims any leading/trailing dashes from the result.
 */
export function sanitizeMikroTikName(name: string): string {
    if (!name) return "unnamed";
    return name.trim()
        .replace(/\s+/g, "-")               // Replace spaces with hyphens
        .replace(/[^a-zA-Z0-9\-]/g, "")    // Remove all non-alphanumeric chars except hyphens
        .replace(/-+/g, "-")               // Collapse multiple consecutive hyphens
        .replace(/^-+|-+$/g, "")           // Trim leading/trailing hyphens
        .toLowerCase()
        || "unnamed";                       // Fallback if result is empty
}

// ── MikroTik API Service Class ──────────────────────────────────────────────

// Rate-limit repeated warnings to prevent log spam.
// Warns are suppressed for the same host+message until WARN_SUPPRESS_MS has passed.
const WARN_SUPPRESS_MS = 5 * 60 * 1000; // 5 minutes
const warnSuppressMap = new Map<string, number>();
function warnOnce(key: string, message: string): void {
    const now = Date.now();
    const lastWarn = warnSuppressMap.get(key) ?? 0;
    if (now - lastWarn >= WARN_SUPPRESS_MS) {
        warnSuppressMap.set(key, now);
        logger.warn(message);
    }
}

export class MikroTikService {
    private conn: MikroTikConnection;
    private routerId: string;
    private tenantId: string | null;
    private db: ReturnType<typeof getTenantClient>;
    private baseUrl: string;

    constructor(conn: MikroTikConnection, routerId: string, tenantId?: string | null) {
        this.conn = conn;
        this.routerId = routerId;
        this.tenantId = tenantId || null;
        this.db = getTenantClient(this.tenantId);
        // E22 FIX: Use the explicit restPort field when set (allows custom REST API ports per router).
        // Fall back to auto-mapping: terminal API ports 8728/8729 are mapped to 80 (HTTP) or 443 (HTTPS).
        const useHttps = env.MIKROTIK_USE_HTTPS;
        let resolvedRestPort: number;
        if (conn.restPort != null) {
            resolvedRestPort = conn.restPort;
        } else {
            resolvedRestPort = (conn.port === 8728 || conn.port === 8729) ? (useHttps ? 443 : 80) : conn.port;
        }
        const protocol = useHttps ? "https" : "http";
        this.baseUrl = `${protocol}://${conn.host}:${resolvedRestPort}`;
    }

    // ── Internal HTTP helper for RouterOS REST API ───────────────────────────

    private getFallbackUrls(originalUrl: string): string[] {
        const urls: string[] = [];
        const parsed = new URL(originalUrl);
        const isPrivateHost = PRIVATE_RE.test(this.conn.host);
        const allowHttpFallback = process.env.MIKROTIK_ALLOW_HTTP_FALLBACK === 'true';

        if (parsed.protocol === 'https:') {
            if (isPrivateHost || allowHttpFallback) {
                const fallback = new URL(originalUrl);
                fallback.protocol = 'http:';
                fallback.port = '80';
                urls.push(fallback.toString());
            }
        } else if (parsed.protocol === 'http:' && isPrivateHost) {
            const fallback = new URL(originalUrl);
            fallback.protocol = 'https:';
            fallback.port = '443';
            urls.push(fallback.toString());
        }

        return urls;
    }

    private async apiRequest(path: string, method: string = "GET", body?: unknown): Promise<any> {
        const url = `${this.baseUrl}/rest${path}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Authorization": "Basic " + Buffer.from(`${this.conn.username}:${this.conn.password}`).toString("base64"),
        };
        const timeoutMs = env.MIKROTIK_TIMEOUT_MS;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const fetchOptions: any = {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            };
            // If using HTTPS and insecure flag is set, allow self‑signed certificates
            // SECURITY WARNING: Only enable MIKROTIK_INSECURE in development or isolated networks.
            // Disabling certificate verification makes connections vulnerable to MITM attacks.
            // Bug #9 FIX: Use ES module import instead of CommonJS require.
            // NOTE: The https.Agent option is not supported by Node.js built-in fetch (v18+).
            // It only works if node-fetch is used as the fetch implementation.
            // For production, prefer a valid TLS cert instead of using MIKROTIK_INSECURE.
            if (this.baseUrl.startsWith('https') && env.MIKROTIK_INSECURE) {
                warnOnce(
                    `insecure:${this.conn.host}`,
                    `[MikroTik] MIKROTIK_INSECURE enabled for ${this.conn.host}. TLS verification disabled. Development/isolated networks only.`
                );
                fetchOptions.agent = new https.Agent({ rejectUnauthorized: false });
            }

            // Perform the HTTP request with fallback from HTTPS to HTTP if needed
            let res;
            try {
                res = await fetch(url, fetchOptions);
            } catch (firstErr: any) {
                const fallbackUrls = this.getFallbackUrls(url);
                if (fallbackUrls.length > 0) {
                    clearTimeout(timeout);
                    warnOnce(
                        `fallback:${this.conn.host}`,
                        `[MikroTik] Initial REST API request failed for ${this.conn.host}, trying protocol fallback. ${PRIVATE_RE.test(this.conn.host) ? 'Private/WireGuard management host detected.' : 'MIKROTIK_ALLOW_HTTP_FALLBACK=true.'}`
                    );
                    let fallbackError: any = firstErr;
                    for (const fallbackUrl of fallbackUrls) {
                        const fallbackController = new AbortController();
                        const fallbackTimeout = setTimeout(() => fallbackController.abort(), timeoutMs);
                        const fallbackOptions = {
                            ...fetchOptions,
                            signal: fallbackController.signal,
                        };

                        try {
                            res = await fetch(fallbackUrl, fallbackOptions);
                            clearTimeout(fallbackTimeout);
                            break;
                        } catch (secondErr) {
                            clearTimeout(fallbackTimeout);
                            fallbackError = secondErr;
                        }
                    }

                    if (!res) {
                        throw fallbackError;
                    }
                } else {
                    clearTimeout(timeout);
                    throw firstErr;
                }
            }

            clearTimeout(timeout);

            if (!res.ok) {
                let errText = await res.text();
                if (errText.trim().toLowerCase().startsWith('<!doctype html>') || errText.trim().toLowerCase().startsWith('<html')) {
                    errText = "Received unexpected HTML response. Ensure the router REST API is enabled and the port is correct.";
                }
                // BUG-FIX: Handle 401 specifically with an actionable auth error instead of a generic one.
                // Previously, the 401 was thrown here and then re-caught below and wrapped with the
                // misleading "Failed to connect to X" prefix — hiding the real cause (wrong credentials).
                if (res.status === 401) {
                    throw new Error(
                        `Authentication failed (401) for router at ${this.conn.host}. ` +
                        `The username "${this.conn.username}" or password stored in the system is incorrect. ` +
                        `Please update router credentials in Settings → Routers → Edit, ` +
                        `or reset the RouterOS admin password to match what is stored.`
                    );
                }
                throw new Error(`RouterOS API error (${res.status}): ${errText}`);
            }

            const text = await res.text();
            return text ? JSON.parse(text) : {};
        } catch (err: any) {
            // BUG-FIX: Re-throw RouterOS HTTP-level errors (401, 4xx, 5xx) WITHOUT wrapping them
            // with the misleading "Failed to connect" prefix. These errors mean the TCP connection
            // SUCCEEDED — the router sent back an HTTP error response. Only network-level failures
            // (AbortError, ECONNREFUSED, EHOSTUNREACH) should use the "Failed to connect" message.
            if (!err.cause && err.name !== 'AbortError') {
                throw err;
            }
            if (err.name === "AbortError") {
                throw new Error(`Connection to ${this.conn.host} timed out after ${timeoutMs / 1000}s. Ensure the router is reachable, REST API service (www/www-ssl) is enabled, and firewall allows inbound traffic on port ${this.baseUrl.includes('https') ? '443' : '80'}.`);
            }
            if (err.cause?.code === "ECONNREFUSED") {
                throw new Error(`Connection refused by ${this.conn.host}. Verify the REST API (www or www-ssl) service is enabled, firewall permits access, and correct port (${this.baseUrl.includes('https') ? '443' : '80'}) is used.`);
            }
            if (err.cause?.code === "EHOSTUNREACH" || err.cause?.code === "ENETUNREACH") {
                const isPrivateIp = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(this.conn.host);
                if (isPrivateIp) {
                    throw new Error(
                        `Router ${this.conn.host} appears unreachable. This is a WireGuard tunnel IP — ` +
                        `the tunnel must be established before you can manage this router. ` +
                        `On the Droplet, run: sudo wg show wg0 — check that the MikroTik peer appears ` +
                        `and has a recent handshake. If not, re-apply the WireGuard config on your MikroTik ` +
                        `or re-run setup-vpn.sh on the Droplet.`
                    );
                }
                throw new Error(`Router ${this.conn.host} appears unreachable. Check network routing, firewalls, and ensure the IP is public or accessible from this server.`);
            }
            const causeMsg = err.cause ? ` (${err.cause.message || err.cause.code})` : '';
            throw new Error(`Failed to connect to ${this.conn.host}${causeMsg}: ${err.message}`);
        }
    }

    // ── Log helper ──────────────────────────────────────────────────────────

    private async log(action: string, details?: string, status: string = "success", username?: string) {
        try {
            await this.db.routerLog.create({
                data: {
                    routerId: this.routerId,
                    action,
                    details,
                    status,
                    username,
                    tenantId: this.tenantId,
                },
            });
        } catch (e) {
            logger.error('[MikroTik] Failed to create router log', {
                routerId: this.routerId,
                action,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }

    // ── Public API Request (for advanced operations like WireGuard push) ───

    async apiRequestPublic(path: string, method: string = "GET", body?: unknown): Promise<any> {
        return this.apiRequest(path, method, body);
    }

    // ── Connection Test ─────────────────────────────────────────────────────

    async testConnection(): Promise<{ success: boolean; message: string; info?: RouterSystemInfo }> {
        try {
            // Check for simulation mode (e.g., if host is "simulation")
            if (this.conn.host.toLowerCase() === "simulation") {
                await this.log("connection_test", "Using simulation mode", "success");
                return { success: true, message: "Simulation mode active" };
            }

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
            await this.db.router.update({
                where: { id: this.routerId },
                data: {
                    status: "ONLINE",
                    cpuLoad: info.cpuLoad,
                    memoryUsed: info.totalMemory > 0
                        ? Math.round((1 - info.freeMemory / info.totalMemory) * 100)
                        : 0,
                    uptime: info.uptime,
                    lastSeen: new Date(),
                },
            });

            await this.log("connection_test", `Connected successfully. RouterOS ${info.version}`, "success");
            return { success: true, message: "Connected successfully", info };
        } catch (err: any) {
            await this.db.router.update({
                where: { id: this.routerId },
                data: { status: "OFFLINE" },
            });
            await this.log("connection_test", err.message, "error");
            return { success: false, message: err.message };
        }
    }

    async listInterfaces(): Promise<any[]> {
        try {
            const interfaces = await this.apiRequest("/interface/ethernet");
            return (interfaces || []).map((i: any) => ({
                name: i.name,
                type: i.type || "ether",
                mac: i["mac-address"] || "",
                status: i.running === "true" || i.running === true ? "Up" : "Down",
                disabled: i.disabled === "true" || i.disabled === true,
                comment: i.comment || "",
            }));
        } catch (err: any) {
            await this.log("list_interfaces", err.message, "error");
            throw err;
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
                password: "***",
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

    async findPPPoEUserByName(username: string): Promise<PPPoEUser | null> {
        try {
            // URL-encode the username to prevent parameter injection
            // even though validateUsername() blocks most payloads, defence-in-depth.
            const users = await this.apiRequest(`/ppp/secret?name=${encodeURIComponent(username)}`);
            if (!users || !Array.isArray(users) || users.length === 0) return null;
            const u = users[0];
            return {
                id: u[".id"],
                name: u.name,
                password: "***",
                service: u.service || "pppoe",
                profile: u.profile || "default",
                disabled: u.disabled === "true" || u.disabled === true,
                comment: u.comment || "",
            };
        } catch (err: any) {
            logger.error(`[MikroTik] Error finding PPPoE user ${username}:`, err.message);
            return null;
        }
    }

    async createPPPoEUser(user: Omit<PPPoEUser, "id">): Promise<PPPoEUser> {
        try {
            validateUsername(user.name);
            validatePassword(user.password);

            const result = await this.apiRequest("/ppp/secret", "PUT", {
                name: user.name,
                password: user.password,
                service: user.service || "pppoe",
                profile: user.profile || "default",
                disabled: user.disabled ? "true" : "false",
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
                password: "***",
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

    async findHotspotUserByName(username: string): Promise<HotspotUser | null> {
        try {
            // URL-encode the username to prevent parameter injection.
            const users = await this.apiRequest(`/ip/hotspot/user?name=${encodeURIComponent(username)}`);
            if (!users || !Array.isArray(users) || users.length === 0) return null;
            const u = users[0];
            return {
                id: u[".id"],
                name: u.name,
                password: "***",
                profile: u.profile || "default",
                server: u.server || "all",
                disabled: u.disabled === "true" || u.disabled === true,
                comment: u.comment || "",
                macAddress: u["mac-address"] || "",
                limitUptime: u["limit-uptime"] || "",
                limitBytesTotal: u["limit-bytes-total"] || "",
            };
        } catch (err: any) {
            logger.error(`[MikroTik] Error finding Hotspot user ${username}:`, err.message);
            return null;
        }
    }

    async createHotspotUser(user: Omit<HotspotUser, "id">): Promise<HotspotUser> {
        try {
            validateUsername(user.name);
            validatePassword(user.password);

            const payload: any = {
                name: user.name,
                password: user.password,
                profile: user.profile || "default",
                server: user.server || "all",
                disabled: user.disabled ? "true" : "false",
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
        await this.db.router.update({
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

    /**
     * RADIUS-001: Kick a customer's currently active session by username,
     * WITHOUT touching any local /ppp/secret or /ip/hotspot/user entry.
     *
     * Used for immediate suspension now that RADIUS is the sole source of
     * truth for auth (see suspendService() below). A closed session simply
     * cannot reconnect afterwards because radcheck.Expiration/Simultaneous-Use
     * already blocks the next Access-Request — this only handles forcing the
     * *current* session off right now instead of waiting for it to expire.
     */
    async kickActiveSession(username: string, serviceType: "pppoe" | "hotspot"): Promise<boolean> {
        if (serviceType === "pppoe") {
            const sessions = await this.listPPPoEActiveSessions();
            const session = sessions.find(s => s.user === username);
            if (session) {
                await this.disconnectPPPoESession(session.id, username);
                return true;
            }
            return false;
        } else {
            const sessions = await this.listHotspotActiveSessions();
            const session = sessions.find(s => s.user === username);
            if (session) {
                await this.disconnectHotspotSession(session.id, username);
                return true;
            }
            return false;
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
            // RouterOS REST API v7: use PUT on the collection to create a new resource
            const result = await this.apiRequest("/ppp/profile", "PUT", {
                name: profile.name,
                "rate-limit": profile.rateLimit,
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
            // RouterOS REST API v7: use PUT on the collection to create a new resource
            const result = await this.apiRequest("/ip/hotspot/user/profile", "PUT", {
                name: profile.name,
                "rate-limit": profile.rateLimit,
                "shared-users": profile.sharedUsers || 1,
            });
            await this.log("create_hotspot_profile", `Created Hotspot profile: ${profile.name} (${profile.rateLimit})`, "success");
            return { ...profile, id: result?.[".id"] || result?.ret };
        } catch (err: any) {
            await this.log("create_hotspot_profile", `Failed: ${err.message}`, "error");
            throw err;
        }
    }

    async upsertPPPoEProfile(profile: Omit<BandwidthProfile, "id">): Promise<BandwidthProfile> {
        const existing = (await this.listPPPoEProfiles()).find(p => p.name === profile.name);
        if (!existing?.id) {
            return this.createPPPoEProfile(profile);
        }
        // RouterOS REST API v7: PATCH on the specific resource ID (no .id in body)
        await this.apiRequest(`/ppp/profile/${existing.id}`, "PATCH", {
            "rate-limit": profile.rateLimit,
        });
        await this.log("update_pppoe_profile", `Updated PPPoE profile: ${profile.name} (${profile.rateLimit})`, "success");
        return { ...profile, id: existing.id };
    }

    async upsertHotspotProfile(profile: Omit<BandwidthProfile, "id">): Promise<BandwidthProfile> {
        const existing = (await this.listHotspotProfiles()).find(p => p.name === profile.name);
        if (!existing?.id) {
            return this.createHotspotProfile(profile);
        }
        // RouterOS REST API v7: PATCH on the specific resource ID (no .id in body)
        await this.apiRequest(`/ip/hotspot/user/profile/${existing.id}`, "PATCH", {
            "rate-limit": profile.rateLimit,
            "shared-users": profile.sharedUsers || 1,
        });
        await this.log("update_hotspot_profile", `Updated Hotspot profile: ${profile.name} (${profile.rateLimit})`, "success");
        return { ...profile, id: existing.id };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AUTOMATION HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * Activate a customer's service after payment.
     *
     * RADIUS-001: This USED to create/enable a local /ppp/secret or
     * /ip/hotspot/user entry for the customer. That has been removed.
     *
     * Every router this app provisions already has
     * `use-radius=yes` set on BOTH the Hotspot server profile and the PPP
     * default profile (see /api/routers/[id]/script). RouterOS's own
     * behaviour is: if a LOCAL secret/hotspot-user with the same name
     * exists, it wins over RADIUS silently — so having both created a
     * hidden race between whichever one was written last (see audit report,
     * point 2: "Kuna sehemu moja ina risk kubwa sana"). RADIUS
     * (radcheck/radreply, written by lib/radius.ts syncRadiusUser()) is now
     * the ONLY source of truth for username, password (MD5), rate limit
     * (Mikrotik-Rate-Limit), profile group (Mikrotik-Group), expiry
     * (Expiration) and simultaneous-use. This method intentionally does
     * nothing on the MikroTik side anymore — it is kept (rather than
     * deleted) so already-queued 'activate-service' jobs and any external
     * callers don't break, and so the RouterLog audit trail still shows an
     * explicit "activation" event per customer.
     */
    async activateService(username: string, _password: string, _profileName: string, serviceType: "pppoe" | "hotspot", _expiresAt?: Date): Promise<void> {
        await this.log(
            "activate_service",
            `No MikroTik-side action taken for ${username} — RADIUS (radcheck/radreply) is the sole source of truth for ${serviceType} auth.`,
            "success",
            username
        );
    }

    /**
     * Suspend a customer's service (expired subscription / non-payment).
     *
     * RADIUS-001: This USED to disable a local /ppp/secret or
     * /ip/hotspot/user entry. Since activateService() no longer creates
     * local entries, there is nothing local left to disable — RADIUS
     * suspension (radcheck.Expiration set in the past, see
     * suspendRadiusUser() in lib/radius.ts) already blocks the NEXT
     * Access-Request. The only thing this method still needs to do on the
     * MikroTik side is force the customer's CURRENT session off immediately,
     * so suspension takes effect right now instead of waiting for their
     * session/lease to naturally expire.
     */
    async suspendService(username: string, serviceType: "pppoe" | "hotspot"): Promise<void> {
        try {
            const kicked = await this.kickActiveSession(username, serviceType);
            await this.log(
                "suspend_service",
                kicked
                    ? `Kicked active ${serviceType} session for ${username} (RADIUS suspension blocks reconnect)`
                    : `No active ${serviceType} session found for ${username} (RADIUS suspension blocks any future connect)`,
                "success",
                username
            );
        } catch (err: any) {
            await this.log("suspend_service", `Failed to kick session for ${username}: ${err.message}`, "error", username);
            throw err;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // VPN USER MANAGEMENT (/ppp/secret)
    // ══════════════════════════════════════════════════════════════════════════

    async createVpnUser(user: { name: string; password: string; service: string; profile: string; localAddress?: string | null; remoteAddress?: string | null }): Promise<void> {
        try {
            await this.apiRequest("/ppp/secret", "PUT", {
                name: user.name,
                password: user.password,
                service: user.service || "any",
                profile: user.profile || "default",
                "local-address": user.localAddress || undefined,
                "remote-address": user.remoteAddress || undefined,
            });
            await this.log("create_vpn_user", `Created VPN user: ${user.name} (${user.service})`, "success", user.name);
        } catch (err: any) {
            await this.log("create_vpn_user", `Failed to create VPN user ${user.name}: ${err.message}`, "error", user.name);
            throw err;
        }
    }

    async deleteVpnUser(username: string): Promise<void> {
        try {
            // Find user ID first
            const users = await this.apiRequest("/ppp/secret");
            const user = (users || []).find((u: any) => u.name === username);
            if (user?.[".id"]) {
                await this.apiRequest(`/ppp/secret/${user[".id"]}`, "DELETE");
                await this.log("delete_vpn_user", `Deleted VPN user: ${username}`, "success", username);
            }
        } catch (err: any) {
            await this.log("delete_vpn_user", `Failed to delete VPN user ${username}: ${err.message}`, "error", username);
            throw err;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // WIREGUARD PEER MANAGEMENT (/interface/wireguard/peers)
    // ══════════════════════════════════════════════════════════════════════════

    async createWireGuardPeer(peer: { publicKey: string; allowedAddress: string; comment?: string; interface?: string }): Promise<void> {
        try {
            // 1. Find a WireGuard interface if not specified
            let iface = peer.interface;
            if (!iface) {
                const interfaces = await this.apiRequest("/interface/wireguard");
                if (interfaces && interfaces.length > 0) {
                    // Try to find wg-hq first, then wireguard1, then the first one
                    const hq = interfaces.find((i: any) => i.name === "wg-hq");
                    const wg1 = interfaces.find((i: any) => i.name === "wireguard1");
                    iface = hq?.name || wg1?.name || interfaces[0].name;
                } else {
                    // Create one if none exists
                    iface = "wg-hq";
                    await this.apiRequest("/interface/wireguard", "PUT", {
                        name: iface,
                        comment: "Auto-created by HQInvestment",
                        "listen-port": "51820"
                    });
                }
            }

            // 2. Create the peer
            await this.apiRequest("/interface/wireguard/peers", "PUT", {
                interface: iface,
                "public-key": peer.publicKey,
                "allowed-address": peer.allowedAddress,
            });
            await this.log("create_wg_peer", `Created WireGuard peer: ${peer.comment} on ${iface}`, "success");
        } catch (err: any) {
            await this.log("create_wg_peer", `Failed to create WG peer: ${err.message}`, "error");
            throw err;
        }
    }

    async deleteWireGuardPeer(publicKeyOrComment: string): Promise<void> {
        try {
            // Find the peer by public key or comment
            const peers = await this.apiRequest("/interface/wireguard/peers");
            const peer = (peers || []).find((p: any) => p["public-key"] === publicKeyOrComment || p.comment === publicKeyOrComment);

            if (peer?.[".id"]) {
                await this.apiRequest(`/interface/wireguard/peers/${peer[".id"]}`, "DELETE");
                await this.log("delete_wg_peer", `Deleted WireGuard peer: ${publicKeyOrComment}`, "success");
            }
        } catch (err: any) {
            await this.log("delete_wg_peer", `Failed to delete WG peer ${publicKeyOrComment}: ${err.message}`, "error");
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
        // MikroTik rate-limit unit suffixes: M=Mbps, k=Kbps, G=Gbps
        const toMtUnit = (unit: string) => unit === "Mbps" ? "M" : unit === "Kbps" ? "k" : unit === "Gbps" ? "G" : "M";
        const uploadStr = `${uploadSpeed}${toMtUnit(uploadUnit)}`;
        const downloadStr = `${downloadSpeed}${toMtUnit(downloadUnit)}`;
        const rateLimit = `${uploadStr}/${downloadStr}`;

        const cleanName = sanitizeMikroTikName(packageName);

        if (serviceType === "pppoe") {
            return this.upsertPPPoEProfile({ name: cleanName, rateLimit, comment: `Auto-synced from package` });
        } else {
            return this.upsertHotspotProfile({ name: cleanName, rateLimit, sharedUsers, comment: `Auto-synced from package` });
        }
    }

    /**
     * Push hotspot login-page customization to the router.
     *
     * TATIZO-A FIX: this used to be a placeholder that returned success
     * without touching the router at all — the custom branded login page
     * (rlogin.html, login.html, etc.) never actually reached the router, so
     * customers always saw MikroTik's stock hotspot page.
     *
     * Real implementation: instruct the router to PULL each templated file
     * from this server via `/tool fetch` (no new inbound port/service needed
     * on the router — it's an outbound request the router already knows how
     * to make). Each file URL is signed + time-limited (see hotspotAssets.ts)
     * since the router has no session/JWT to authenticate with.
     */
    async pushHotspotSettings(settings: any): Promise<{ success: boolean; message: string }> {
        try {
            const { listHotspotFiles, buildSignedAssetUrl } = await import("./hotspotAssets");

            const baseUrl = (
                settings?.backendUrl ||
                env.NEXT_PUBLIC_APP_URL ||
                (process.env.APP_URL as string | undefined) ||
                ""
            ).replace(/\/$/, "");

            if (!baseUrl) {
                throw new Error(
                    "No reachable backend URL configured (set APP_URL / NEXT_PUBLIC_APP_URL, or a per-router " +
                    "backendUrl in Hotspot Settings). The router must be able to reach this server over " +
                    "HTTP(S) to pull the hotspot login-page files."
                );
            }

            const files = listHotspotFiles();
            let pushed = 0;
            const failures: string[] = [];

            for (const file of files) {
                const url = buildSignedAssetUrl(baseUrl, this.routerId, file.relPath);
                const dstPath = `hotspot/${file.relPath}`;
                try {
                    // RouterOS REST API: POST /rest/tool/fetch runs the fetch job.
                    // On RouterOS 7 this blocks until the download finishes/fails
                    // and reports status in the response body.
                    await this.apiRequest("/tool/fetch", "POST", {
                        url,
                        "dst-path": dstPath,
                        "http-method": "get",
                    });
                    pushed++;
                } catch (fileErr: any) {
                    failures.push(`${file.relPath}: ${fileErr.message}`);
                }
            }

            await this.log(
                "push_hotspot_settings",
                `Pushed ${pushed}/${files.length} hotspot files via /tool fetch` +
                (failures.length ? `; failures: ${failures.join("; ")}` : ""),
                failures.length === 0 ? "success" : "error"
            );

            if (failures.length > 0) {
                return {
                    success: false,
                    message: `Pushed ${pushed}/${files.length} files. Failed: ${failures.slice(0, 5).join("; ")}${failures.length > 5 ? " …" : ""}`,
                };
            }

            return { success: true, message: `Pushed ${pushed} hotspot files to the router.` };
        } catch (err: any) {
            await this.log("push_hotspot_settings", `Failed: ${err.message}`, "error");
            throw err;
        }
    }
}

// ── Factory Function ────────────────────────────────────────────────────────

export async function getMikroTikService(routerId: string, tenantId?: string | null): Promise<MikroTikService> {
    // Use an unscoped tenant client for the lookup so we can distinguish
    // "router does not exist" from "router exists but belongs to another tenant".
    const unscopedDb = getTenantClient(null);
    const router = await unscopedDb.router.findUnique({ where: { id: routerId } });
    if (!router) throw new Error("Router not found");

    // Strict tenant isolation check for callers that explicitly provide a tenant.
    // When no tenant is supplied, preserve the existing behavior for legacy callers.
    if (tenantId !== undefined && tenantId !== null && router.tenantId !== tenantId) {
        throw new Error("Unauthorized: This router belongs to another tenant");
    }

    // MK-004 / SEC-001 FIX: Decrypt router credentials before use.
    const decryptedRouter = decryptRouterFields(router);

    // HIGH-SEC SSRF FIX: Validate the host before making any outbound connection.
    // Blocks loopback, link-local (metadata), and private IPs unless the router is
    // explicitly configured to use WireGuard for management.
    const allowPrivateForWireGuardRouter = Boolean(
        process.env.MIKROTIK_ALLOW_PRIVATE === 'true' ||
        (router.wgEnabled && decryptedRouter.host && PRIVATE_RE.test(decryptedRouter.host)) ||
        (router.wgTunnelIp && decryptedRouter.host === router.wgTunnelIp)
    );

    validateOutboundHost(decryptedRouter.host, { allowPrivate: allowPrivateForWireGuardRouter });

    // BUG-FIX: Use decryptedRouter for ALL credential fields (username, password, host) to be
    // consistent. username is not encrypted but using decryptedRouter (which spreads all fields
    // from router) ensures both come from the same decrypted record.
    if (!decryptedRouter.password) {
        logger.warn(
            `[MikroTik] Router ${routerId} has no password set in the database. ` +
            `An empty password will be sent — this will cause a 401 if the RouterOS admin ` +
            `account has a password. Set the password in Settings → Routers → Edit.`
        );
    }

    return new MikroTikService(
        {
            host: decryptedRouter.host,
            port: router.apiPort || router.port || 8728,
            restPort: (router as any).restPort ?? undefined,
            username: decryptedRouter.username || "admin",   // BUG-FIX: use decryptedRouter consistently
            password: decryptedRouter.password || "",
        },
        routerId,
        router.tenantId,
    );
}
