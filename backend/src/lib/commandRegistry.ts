/**
 * Command Compatibility Registry
 *
 * VENDOR-ADAPTER-003: Version-aware command generator for multi-vendor router management.
 *
 * Solves: Commands that differ between RouterOS v6 and v7, Omada vs UniFi syntax,
 * and capabilities that only exist from a specific firmware version onwards.
 *
 * Design principles:
 *   - Never guess compatibility — always look up from the registry
 *   - Every entry specifies exact minVersion; maxVersion is optional (no upper bound by default)
 *   - Commands are templates with {{placeholder}} variables for runtime substitution
 *   - All entries are immutable at runtime — loaded once, read-many
 */

export type RouterVendor = "mikrotik" | "omada" | "unifi" | "tplink" | "future";

// ── Version Parsing ────────────────────────────────────────────────────────────

export interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    raw: string;
}

export function parseVersion(version: string): ParsedVersion {
    // Handles: "7.15.3", "6.49.10", "7", "6.49"
    const clean = (version || "0").replace(/[^0-9.]/g, "");
    const parts = clean.split(".").map(Number);
    return {
        major: parts[0] ?? 0,
        minor: parts[1] ?? 0,
        patch: parts[2] ?? 0,
        raw: version,
    };
}

export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
}

export function isVersionAtLeast(current: string, minRequired: string): boolean {
    return compareVersions(parseVersion(current), parseVersion(minRequired)) >= 0;
}

export function isVersionInRange(current: string, min: string, max?: string): boolean {
    if (!isVersionAtLeast(current, min)) return false;
    if (max && compareVersions(parseVersion(current), parseVersion(max)) > 0) return false;
    return true;
}

// ── Command Template System ────────────────────────────────────────────────────

/** Substitute {{key}} placeholders in a command template */
export function renderCommand(template: string, vars: Record<string, string | number | boolean>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = vars[key];
        if (val === undefined) {
            throw new Error(`[CommandRegistry] Missing template variable: {{${key}}} in: ${template}`);
        }
        return String(val);
    });
}

// ── Registry Entry Types ────────────────────────────────────────────────────────

export type CommandSyntax = "REST" | "SSH_CLI" | "CONTROLLER_API" | "HTTP_API";

export interface CommandEntry {
    /** Unique command identifier */
    id: string;
    /** The logical feature/operation this command performs */
    feature: string;
    /** Vendor this entry applies to */
    vendor: RouterVendor;
    /** Minimum firmware version required (inclusive) */
    minVersion: string;
    /** Maximum firmware version (exclusive). Omit for "no upper bound" */
    maxVersion?: string;
    /** API mechanism used */
    syntax: CommandSyntax;
    /**
     * Command template. For REST: the HTTP method + path.
     * For SSH_CLI: the RouterOS script command.
     * Variables use {{name}} notation.
     */
    template: string;
    /** Body template for REST PUT/POST commands (JSON string with {{vars}}) */
    bodyTemplate?: string;
    /** HTTP method if REST */
    method?: "GET" | "PUT" | "POST" | "PATCH" | "DELETE";
    /** Human-readable description */
    description: string;
    /** Whether this command is idempotent — safe to run multiple times */
    idempotent: boolean;
    /** Corresponding rollback command ID (optional) */
    rollbackId?: string;
    /** Whether to skip this command when resource already exists */
    skipIfExists?: boolean;
    /** API path to check for existence before executing */
    existsCheckPath?: string;
    /** Field in existing resource response to check (e.g. "name") */
    existsCheckField?: string;
}

// ── The Registry ───────────────────────────────────────────────────────────────

const REGISTRY: CommandEntry[] = [

    // ══════════════════════════════════════════════════════════════════════════
    // MIKROTIK — RouterOS 6.49+ (Legacy REST / SSH)
    // ══════════════════════════════════════════════════════════════════════════

    // ── Bridge ────────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.bridge.create",
        feature: "create-bridge",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/interface/bridge",
        bodyTemplate: '{"name":"{{name}}","comment":"{{comment}}","protocol-mode":"rstp","vlan-filtering":"false"}',
        description: "Create a bridge interface (RouterOS v6)",
        idempotent: true,
        rollbackId: "mikrotik.v6.bridge.delete",
        skipIfExists: true,
        existsCheckPath: "/interface/bridge",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v7.bridge.create",
        feature: "create-bridge",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/interface/bridge",
        bodyTemplate: '{"name":"{{name}}","comment":"{{comment}}","protocol-mode":"rstp","vlan-filtering":"false","pvid":"1"}',
        description: "Create a bridge interface (RouterOS v7 — adds pvid field)",
        idempotent: true,
        rollbackId: "mikrotik.v7.bridge.delete",
        skipIfExists: true,
        existsCheckPath: "/interface/bridge",
        existsCheckField: "name",
    },

    // ── Bridge Delete ─────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.bridge.delete",
        feature: "delete-bridge",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "DELETE",
        template: "/interface/bridge/{{id}}",
        description: "Delete a bridge interface (RouterOS v6)",
        idempotent: false,
    },
    {
        id: "mikrotik.v7.bridge.delete",
        feature: "delete-bridge",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "DELETE",
        template: "/interface/bridge/{{id}}",
        description: "Delete a bridge interface (RouterOS v7)",
        idempotent: false,
    },

    // ── Bridge Port ───────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.bridge.port.add",
        feature: "add-bridge-port",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/interface/bridge/port",
        bodyTemplate: '{"bridge":"{{bridge}}","interface":"{{interface}}","comment":"{{comment}}"}',
        description: "Add port to bridge (RouterOS v6)",
        idempotent: true,
        skipIfExists: true,
    },
    {
        id: "mikrotik.v7.bridge.port.add",
        feature: "add-bridge-port",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/interface/bridge/port",
        bodyTemplate: '{"bridge":"{{bridge}}","interface":"{{interface}}","comment":"{{comment}}","frame-types":"admit-all","pvid":"{{pvid}}"}',
        description: "Add port to bridge (RouterOS v7 — adds frame-types and pvid)",
        idempotent: true,
        skipIfExists: true,
    },

    // ── IP Pool ───────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.ippool.create",
        feature: "create-ip-pool",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/ip/pool",
        bodyTemplate: '{"name":"{{name}}","ranges":"{{ranges}}","comment":"{{comment}}"}',
        description: "Create IP pool (RouterOS v6)",
        idempotent: true,
        rollbackId: "mikrotik.v6.ippool.delete",
        skipIfExists: true,
        existsCheckPath: "/ip/pool",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v7.ippool.create",
        feature: "create-ip-pool",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/ip/pool",
        bodyTemplate: '{"name":"{{name}}","ranges":"{{ranges}}","comment":"{{comment}}"}',
        description: "Create IP pool (RouterOS v7 — identical syntax)",
        idempotent: true,
        rollbackId: "mikrotik.v7.ippool.delete",
        skipIfExists: true,
        existsCheckPath: "/ip/pool",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v6.ippool.delete",
        feature: "delete-ip-pool",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "DELETE",
        template: "/ip/pool/{{id}}",
        description: "Delete IP pool",
        idempotent: false,
    },
    {
        id: "mikrotik.v7.ippool.delete",
        feature: "delete-ip-pool",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "DELETE",
        template: "/ip/pool/{{id}}",
        description: "Delete IP pool",
        idempotent: false,
    },

    // ── DHCP Server ───────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.dhcp.server.create",
        feature: "create-dhcp-server",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/ip/dhcp-server",
        bodyTemplate: '{"name":"{{name}}","interface":"{{interface}}","address-pool":"{{pool}}","lease-time":"{{leaseTime}}","disabled":"false","comment":"{{comment}}"}',
        description: "Create DHCP server (RouterOS v6)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/ip/dhcp-server",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v7.dhcp.server.create",
        feature: "create-dhcp-server",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/ip/dhcp-server",
        bodyTemplate: '{"name":"{{name}}","interface":"{{interface}}","address-pool":"{{pool}}","lease-time":"{{leaseTime}}","disabled":"false","comment":"{{comment}}","use-radius":"{{useRadius}}"}',
        description: "Create DHCP server (RouterOS v7 — adds use-radius field)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/ip/dhcp-server",
        existsCheckField: "name",
    },

    // ── DHCP Network ─────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.dhcp.network.create",
        feature: "create-dhcp-network",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PUT",
        template: "/ip/dhcp-server/network",
        bodyTemplate: '{"address":"{{network}}","gateway":"{{gateway}}","dns-server":"{{dns}}","comment":"{{comment}}"}',
        description: "Create DHCP network definition",
        idempotent: true,
        skipIfExists: true,
    },

    // ── PPP Profile ───────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.ppp.profile.create",
        feature: "create-ppp-profile",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/ppp/profile",
        bodyTemplate: '{"name":"{{name}}","local-address":"{{localAddress}}","remote-address":"{{remoteAddress}}","rate-limit":"{{rateLimit}}","comment":"{{comment}}"}',
        description: "Create PPP profile (RouterOS v6)",
        idempotent: true,
        rollbackId: "mikrotik.v6.ppp.profile.delete",
        skipIfExists: true,
        existsCheckPath: "/ppp/profile",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v7.ppp.profile.create",
        feature: "create-ppp-profile",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/ppp/profile",
        bodyTemplate: '{"name":"{{name}}","local-address":"{{localAddress}}","remote-address":"{{remoteAddress}}","rate-limit":"{{rateLimit}}","comment":"{{comment}}","address-list":"{{addressList}}"}',
        description: "Create PPP profile (RouterOS v7 — adds address-list field)",
        idempotent: true,
        rollbackId: "mikrotik.v7.ppp.profile.delete",
        skipIfExists: true,
        existsCheckPath: "/ppp/profile",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v6.ppp.profile.delete",
        feature: "delete-ppp-profile",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "DELETE",
        template: "/ppp/profile/{{id}}",
        description: "Delete PPP profile",
        idempotent: false,
    },
    {
        id: "mikrotik.v7.ppp.profile.delete",
        feature: "delete-ppp-profile",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "DELETE",
        template: "/ppp/profile/{{id}}",
        description: "Delete PPP profile",
        idempotent: false,
    },

    // ── PPPoE Server ──────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.pppoe.server.create",
        feature: "create-pppoe-server",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/interface/pppoe-server/server",
        bodyTemplate: '{"interface":"{{interface}}","service-name":"{{serviceName}}","max-mru":"1480","max-mtu":"1480","authentication":"mschap2,mschap1,chap,pap","default-profile":"{{profile}}","disabled":"false","comment":"{{comment}}"}',
        description: "Create PPPoE server (RouterOS v6)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/interface/pppoe-server/server",
        existsCheckField: "service-name",
    },
    {
        id: "mikrotik.v7.pppoe.server.create",
        feature: "create-pppoe-server",
        vendor: "mikrotik",
        minVersion: "7.0",
        syntax: "REST",
        method: "PUT",
        template: "/interface/pppoe-server/server",
        bodyTemplate: '{"interface":"{{interface}}","service-name":"{{serviceName}}","max-mru":"1480","max-mtu":"1480","authentication":"mschap2,mschap1,chap,pap","default-profile":"{{profile}}","disabled":"false","comment":"{{comment}}","one-session-per-host":"yes"}',
        description: "Create PPPoE server (RouterOS v7 — adds one-session-per-host)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/interface/pppoe-server/server",
        existsCheckField: "service-name",
    },

    // ── PPPoE User ────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.pppoe.user.create",
        feature: "create-pppoe-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PUT",
        template: "/ppp/secret",
        bodyTemplate: '{"name":"{{username}}","password":"{{password}}","service":"pppoe","profile":"{{profile}}","comment":"{{comment}}","disabled":"false"}',
        description: "Create PPPoE user",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/ppp/secret",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v6.pppoe.user.delete",
        feature: "delete-pppoe-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "DELETE",
        template: "/ppp/secret/{{id}}",
        description: "Delete PPPoE user",
        idempotent: false,
    },
    {
        id: "mikrotik.v6.pppoe.user.enable",
        feature: "enable-pppoe-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PATCH",
        template: "/ppp/secret/{{id}}",
        bodyTemplate: '{"disabled":"false"}',
        description: "Enable PPPoE user",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.pppoe.user.disable",
        feature: "disable-pppoe-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PATCH",
        template: "/ppp/secret/{{id}}",
        bodyTemplate: '{"disabled":"true"}',
        description: "Disable/suspend PPPoE user",
        idempotent: true,
    },

    // ── Hotspot Profile ───────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.hotspot.profile.create",
        feature: "create-hotspot-profile",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PUT",
        template: "/ip/hotspot/user/profile",
        bodyTemplate: '{"name":"{{name}}","rate-limit":"{{rateLimit}}","shared-users":"{{sharedUsers}}","comment":"{{comment}}"}',
        description: "Create Hotspot user profile",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/ip/hotspot/user/profile",
        existsCheckField: "name",
    },

    // ── Hotspot User ──────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.hotspot.user.create",
        feature: "create-hotspot-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PUT",
        template: "/ip/hotspot/user",
        bodyTemplate: '{"name":"{{username}}","password":"{{password}}","profile":"{{profile}}","comment":"{{comment}}","disabled":"false"}',
        description: "Create Hotspot user",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/ip/hotspot/user",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v6.hotspot.user.delete",
        feature: "delete-hotspot-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "DELETE",
        template: "/ip/hotspot/user/{{id}}",
        description: "Delete Hotspot user",
        idempotent: false,
    },
    {
        id: "mikrotik.v6.hotspot.user.enable",
        feature: "enable-hotspot-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PATCH",
        template: "/ip/hotspot/user/{{id}}",
        bodyTemplate: '{"disabled":"false"}',
        description: "Enable Hotspot user",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.hotspot.user.disable",
        feature: "disable-hotspot-user",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PATCH",
        template: "/ip/hotspot/user/{{id}}",
        bodyTemplate: '{"disabled":"true"}',
        description: "Disable/suspend Hotspot user",
        idempotent: true,
    },

    // ── Simple Queue ──────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.queue.simple.create",
        feature: "create-queue",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PUT",
        template: "/queue/simple",
        bodyTemplate: '{"name":"{{name}}","target":"{{target}}","max-limit":"{{maxLimit}}","burst-limit":"{{burstLimit}}","burst-threshold":"{{burstThreshold}}","burst-time":"{{burstTime}}","comment":"{{comment}}"}',
        description: "Create simple queue for bandwidth management",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/queue/simple",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v6.queue.simple.delete",
        feature: "delete-queue",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "DELETE",
        template: "/queue/simple/{{id}}",
        description: "Delete simple queue",
        idempotent: false,
    },

    // ── Firewall Rules ────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.firewall.filter.add",
        feature: "create-firewall-filter",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.13",
        syntax: "REST",
        method: "PUT",
        template: "/ip/firewall/filter",
        bodyTemplate: '{"chain":"{{chain}}","action":"{{action}}","src-address":"{{srcAddress}}","dst-address":"{{dstAddress}}","protocol":"{{protocol}}","comment":"{{comment}}"}',
        description: "Add firewall filter rule (RouterOS v6 / early v7)",
        idempotent: false,
    },
    {
        id: "mikrotik.v7.firewall.filter.add",
        feature: "create-firewall-filter",
        vendor: "mikrotik",
        minVersion: "7.13",
        syntax: "REST",
        method: "PUT",
        template: "/ip/firewall/filter",
        bodyTemplate: '{"chain":"{{chain}}","action":"{{action}}","src-address":"{{srcAddress}}","dst-address":"{{dstAddress}}","protocol":"{{protocol}}","comment":"{{comment}}","connection-state":"{{connectionState}}"}',
        description: "Add firewall filter rule (RouterOS v7.13+ — adds connection-state)",
        idempotent: false,
    },

    // ── NAT ───────────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.nat.masquerade",
        feature: "create-nat-masquerade",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "PUT",
        template: "/ip/firewall/nat",
        bodyTemplate: '{"chain":"srcnat","action":"masquerade","out-interface":"{{wanInterface}}","comment":"{{comment}}"}',
        description: "Create NAT masquerade rule for WAN",
        idempotent: true,
        skipIfExists: true,
    },

    // ── RADIUS ────────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.radius.add",
        feature: "add-radius-server",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.10",
        syntax: "REST",
        method: "PUT",
        template: "/radius",
        bodyTemplate: '{"service":"ppp,hotspot","address":"{{radiusServer}}","secret":"{{radiusSecret}}","timeout":"3000","authentication-port":"{{authPort}}","accounting-port":"{{acctPort}}","comment":"{{comment}}"}',
        description: "Add RADIUS server (RouterOS v6)",
        idempotent: true,
        skipIfExists: true,
    },
    {
        id: "mikrotik.v7.radius.add",
        feature: "add-radius-server",
        vendor: "mikrotik",
        minVersion: "7.10",
        syntax: "REST",
        method: "PUT",
        template: "/radius",
        bodyTemplate: '{"service":"ppp,hotspot","address":"{{radiusServer}}","secret":"{{radiusSecret}}","timeout":"3000","authentication-port":"{{authPort}}","accounting-port":"{{acctPort}}","comment":"{{comment}}","use-tls":"{{useTls}}"}',
        description: "Add RADIUS server (RouterOS v7.10+ — adds RADIUS-over-TLS support)",
        idempotent: true,
        skipIfExists: true,
    },

    // ── WireGuard (RouterOS v7.6+) ────────────────────────────────────────────
    {
        id: "mikrotik.v7.wireguard.interface.create",
        feature: "create-wireguard-interface",
        vendor: "mikrotik",
        minVersion: "7.6",
        syntax: "REST",
        method: "PUT",
        template: "/interface/wireguard",
        bodyTemplate: '{"name":"{{name}}","listen-port":"{{listenPort}}","private-key":"{{privateKey}}","comment":"{{comment}}"}',
        description: "Create WireGuard interface (RouterOS v7.6+)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/interface/wireguard",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v7.wireguard.peer.add",
        feature: "add-wireguard-peer",
        vendor: "mikrotik",
        minVersion: "7.6",
        syntax: "REST",
        method: "PUT",
        template: "/interface/wireguard/peers",
        bodyTemplate: '{"interface":"{{interface}}","public-key":"{{publicKey}}","allowed-address":"{{allowedAddress}}","preshared-key":"{{presharedKey}}","persistent-keepalive":"25","comment":"{{comment}}"}',
        description: "Add WireGuard peer (RouterOS v7.6+)",
        idempotent: true,
        skipIfExists: true,
    },
    {
        id: "mikrotik.v7.wireguard.peer.delete",
        feature: "delete-wireguard-peer",
        vendor: "mikrotik",
        minVersion: "7.6",
        syntax: "REST",
        method: "DELETE",
        template: "/interface/wireguard/peers/{{id}}",
        description: "Delete WireGuard peer",
        idempotent: false,
    },

    // ── System ────────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.system.identity.get",
        feature: "get-system-identity",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "GET",
        template: "/system/identity",
        description: "Get router identity/name",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.system.resource.get",
        feature: "get-system-resource",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "GET",
        template: "/system/resource",
        description: "Get system resource info (CPU, memory, version, arch)",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.system.package.get",
        feature: "get-installed-packages",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "GET",
        template: "/system/package",
        description: "Get installed packages to detect capabilities",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.system.reboot",
        feature: "reboot",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "POST",
        template: "/system/reboot",
        bodyTemplate: "{}",
        description: "Reboot the router",
        idempotent: false,
    },
    {
        id: "mikrotik.v6.system.backup.create",
        feature: "create-backup",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "POST",
        template: "/system/backup/save",
        bodyTemplate: '{"name":"{{name}}","dont-encrypt":"yes"}',
        description: "Create a configuration backup",
        idempotent: false,
    },

    // ── Active Session Management ─────────────────────────────────────────────
    {
        id: "mikrotik.v6.pppoe.active.list",
        feature: "list-active-pppoe",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "GET",
        template: "/ppp/active",
        description: "List active PPPoE sessions",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.pppoe.active.disconnect",
        feature: "disconnect-pppoe-session",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "POST",
        template: "/ppp/active/remove",
        bodyTemplate: '{".id":"{{id}}"}',
        description: "Disconnect active PPPoE session",
        idempotent: false,
    },
    {
        id: "mikrotik.v6.hotspot.active.list",
        feature: "list-active-hotspot",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "GET",
        template: "/ip/hotspot/active",
        description: "List active Hotspot sessions",
        idempotent: true,
    },
    {
        id: "mikrotik.v6.hotspot.active.disconnect",
        feature: "disconnect-hotspot-session",
        vendor: "mikrotik",
        minVersion: "6.49",
        syntax: "REST",
        method: "POST",
        template: "/ip/hotspot/active/remove",
        bodyTemplate: '{".id":"{{id}}"}',
        description: "Disconnect active Hotspot session",
        idempotent: false,
    },

    // ── VLAN ──────────────────────────────────────────────────────────────────
    {
        id: "mikrotik.v6.vlan.create",
        feature: "create-vlan",
        vendor: "mikrotik",
        minVersion: "6.49",
        maxVersion: "7.13",
        syntax: "REST",
        method: "PUT",
        template: "/interface/vlan",
        bodyTemplate: '{"name":"{{name}}","interface":"{{interface}}","vlan-id":"{{vlanId}}","comment":"{{comment}}"}',
        description: "Create VLAN interface (RouterOS v6)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/interface/vlan",
        existsCheckField: "name",
    },
    {
        id: "mikrotik.v7.vlan.create",
        feature: "create-vlan",
        vendor: "mikrotik",
        minVersion: "7.13",
        syntax: "REST",
        method: "PUT",
        template: "/interface/vlan",
        bodyTemplate: '{"name":"{{name}}","interface":"{{interface}}","vlan-id":"{{vlanId}}","comment":"{{comment}}","use-service-tag":"no"}',
        description: "Create VLAN interface (RouterOS v7.13+)",
        idempotent: true,
        skipIfExists: true,
        existsCheckPath: "/interface/vlan",
        existsCheckField: "name",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // OMADA — Controller API (version-agnostic where possible)
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: "omada.v5.auth.login",
        feature: "auth-login",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "POST",
        template: "/api/v2/hotspot/login",
        bodyTemplate: '{"username":"{{username}}","password":"{{password}}"}',
        description: "Authenticate with Omada controller (v5+)",
        idempotent: false,
    },
    {
        id: "omada.v5.sites.list",
        feature: "list-sites",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/v2/sites",
        description: "List all managed sites",
        idempotent: true,
    },
    {
        id: "omada.v5.devices.list",
        feature: "list-devices",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/v2/sites/{{siteId}}/devices",
        description: "List devices in a site",
        idempotent: true,
    },
    {
        id: "omada.v5.clients.list",
        feature: "list-clients",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/v2/sites/{{siteId}}/clients",
        description: "List connected clients",
        idempotent: true,
    },
    {
        id: "omada.v5.network.create",
        feature: "create-network",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "POST",
        template: "/api/v2/sites/{{siteId}}/setting/lan/networks",
        bodyTemplate: '{"name":"{{name}}","purpose":"guest","gatewaySubnet":"{{subnet}}","dhcpServer":true}',
        description: "Create network/LAN in Omada site",
        idempotent: true,
        skipIfExists: true,
    },
    {
        id: "omada.v5.vlan.create",
        feature: "create-vlan",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "POST",
        template: "/api/v2/sites/{{siteId}}/setting/lan/networks",
        bodyTemplate: '{"name":"{{name}}","purpose":"corporate","vlan":"{{vlanId}}","gatewaySubnet":"{{subnet}}"}',
        description: "Create VLAN network in Omada site",
        idempotent: true,
    },
    {
        id: "omada.v5.health.get",
        feature: "health-check",
        vendor: "omada",
        minVersion: "5.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/v2/sites/{{siteId}}/dashboard/overallStat",
        description: "Get overall site health statistics",
        idempotent: true,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // UNIFI — Network Application API
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: "unifi.v7.auth.login",
        feature: "auth-login",
        vendor: "unifi",
        minVersion: "7.0",
        syntax: "CONTROLLER_API",
        method: "POST",
        template: "/api/auth/login",
        bodyTemplate: '{"username":"{{username}}","password":"{{password}}","remember":false}',
        description: "Authenticate with UniFi Network Application (v7+)",
        idempotent: false,
    },
    {
        id: "unifi.v7.sites.list",
        feature: "list-sites",
        vendor: "unifi",
        minVersion: "7.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/self/sites",
        description: "List all UniFi sites",
        idempotent: true,
    },
    {
        id: "unifi.v7.clients.list",
        feature: "list-clients",
        vendor: "unifi",
        minVersion: "7.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/s/{{site}}/stat/sta",
        description: "List active clients on a site",
        idempotent: true,
    },
    {
        id: "unifi.v7.network.create",
        feature: "create-network",
        vendor: "unifi",
        minVersion: "7.0",
        syntax: "CONTROLLER_API",
        method: "POST",
        template: "/api/s/{{site}}/rest/networkconf",
        bodyTemplate: '{"name":"{{name}}","purpose":"corporate","ip_subnet":"{{subnet}}","vlan":"{{vlanId}}","dhcpd_enabled":true}',
        description: "Create network on UniFi site",
        idempotent: true,
    },
    {
        id: "unifi.v7.health.get",
        feature: "health-check",
        vendor: "unifi",
        minVersion: "7.0",
        syntax: "CONTROLLER_API",
        method: "GET",
        template: "/api/s/{{site}}/stat/health",
        description: "Get site health status",
        idempotent: true,
    },
    {
        id: "unifi.v7.device.restart",
        feature: "reboot",
        vendor: "unifi",
        minVersion: "7.0",
        syntax: "CONTROLLER_API",
        method: "POST",
        template: "/api/s/{{site}}/cmd/devmgr",
        bodyTemplate: '{"cmd":"restart","mac":"{{mac}}"}',
        description: "Restart a UniFi device",
        idempotent: false,
    },

    // ══════════════════════════════════════════════════════════════════════════
    // TP-LINK BUSINESS ROUTER REST API
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: "tplink.v1.auth.login",
        feature: "auth-login",
        vendor: "tplink",
        minVersion: "1.0",
        syntax: "HTTP_API",
        method: "POST",
        template: "/cgi-bin/luci/;stok=/rpc/xqsystem/login",
        bodyTemplate: '{"method":"do","login":{"username":"{{username}}","password":"{{password}}"}}',
        description: "Authenticate with TP-Link business router",
        idempotent: false,
    },
    {
        id: "tplink.v1.dhcp.get",
        feature: "get-dhcp",
        vendor: "tplink",
        minVersion: "1.0",
        syntax: "HTTP_API",
        method: "POST",
        template: "/cgi-bin/luci/;stok={{token}}/rpc/xqnetwork/get_lan_info",
        bodyTemplate: '{"method":"do"}',
        description: "Get DHCP/LAN settings",
        idempotent: true,
    },
    {
        id: "tplink.v1.reboot",
        feature: "reboot",
        vendor: "tplink",
        minVersion: "1.0",
        syntax: "HTTP_API",
        method: "POST",
        template: "/cgi-bin/luci/;stok={{token}}/rpc/xqsystem/reboot",
        bodyTemplate: '{"method":"do"}',
        description: "Reboot TP-Link router",
        idempotent: false,
    },
];

// ── Registry Lookup Functions ──────────────────────────────────────────────────

/**
 * Find the best matching command entry for a given vendor, version, and feature.
 * Picks the most specific (highest minVersion) match within the version range.
 */
export function getCommand(
    vendor: RouterVendor,
    firmwareVersion: string,
    feature: string
): CommandEntry | undefined {
    const version = parseVersion(firmwareVersion);

    const matches = REGISTRY.filter(entry => {
        if (entry.vendor !== vendor) return false;
        if (entry.feature !== feature) return false;
        if (!isVersionAtLeast(firmwareVersion, entry.minVersion)) return false;
        if (entry.maxVersion && !isVersionInRange(firmwareVersion, entry.minVersion, entry.maxVersion)) return false;
        return true;
    });

    if (matches.length === 0) return undefined;

    // Return the most specific match (highest minVersion)
    return matches.sort((a, b) =>
        compareVersions(parseVersion(b.minVersion), parseVersion(a.minVersion))
    )[0];
}

/**
 * Get all features supported by a vendor+version combination.
 */
export function getSupportedFeatures(vendor: RouterVendor, firmwareVersion: string): string[] {
    const seen = new Set<string>();
    REGISTRY.forEach(entry => {
        if (entry.vendor !== vendor) return;
        if (!isVersionAtLeast(firmwareVersion, entry.minVersion)) return;
        if (entry.maxVersion && !isVersionInRange(firmwareVersion, entry.minVersion, entry.maxVersion)) return;
        seen.add(entry.feature);
    });
    return Array.from(seen);
}

/**
 * Check if a specific feature is available for this vendor/version.
 */
export function isFeatureSupported(
    vendor: RouterVendor,
    firmwareVersion: string,
    feature: string
): boolean {
    return !!getCommand(vendor, firmwareVersion, feature);
}

/**
 * Build the full URL path with variables substituted.
 */
export function buildCommandPath(entry: CommandEntry, vars: Record<string, string | number | boolean>): string {
    return renderCommand(entry.template, vars);
}

/**
 * Build the request body with variables substituted.
 */
export function buildCommandBody(entry: CommandEntry, vars: Record<string, string | number | boolean>): Record<string, unknown> | undefined {
    if (!entry.bodyTemplate) return undefined;
    const rendered = renderCommand(entry.bodyTemplate, vars);
    return JSON.parse(rendered);
}

/**
 * Get all commands for a vendor/version pair — useful for capability discovery.
 */
export function getAllCommandsForVersion(vendor: RouterVendor, firmwareVersion: string): CommandEntry[] {
    return REGISTRY.filter(entry => {
        if (entry.vendor !== vendor) return false;
        if (!isVersionAtLeast(firmwareVersion, entry.minVersion)) return false;
        if (entry.maxVersion && !isVersionInRange(firmwareVersion, entry.minVersion, entry.maxVersion)) return false;
        return true;
    });
}

export { REGISTRY as commandRegistry };
