import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService, sanitizeMikroTikName } from "@/lib/mikrotik";
import { wireguardManager } from "@/lib/wireguard";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

// ── Raw SQL helpers (bypass Prisma client validation for new fields) ────────

async function getRouterWgFields(routerId: string) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT "wgPrivateKey", "wgPublicKey", "wgPeerPublicKey", "wgPresharedKey",
                "wgTunnelIp", "wgServerEndpoint", "wgListenPort", "wgEnabled", "wgConfiguredAt",
                "host", "name", "id", "tenantId", "port", "apiPort", "password", "username"
         FROM "routers" WHERE "id" = $1 LIMIT 1`,
        routerId,
    ) as any[];
    return rows[0] || null;
}

async function updateRouterWgFields(routerId: string, data: Record<string, any>) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(data)) {
        setClauses.push(`"${key}" = $${idx}`);
        values.push(val);
        idx++;
    }

    values.push(routerId);
    await prisma.$executeRawUnsafe(
        `UPDATE "routers" SET ${setClauses.join(", ")} WHERE "id" = $${idx}`,
        ...values,
    );
}

// ── GET /api/routers/[id]/wireguard — Get or generate WireGuard config ──────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const router = await getRouterWgFields(id);
        if (!router) return errorResponse("Router not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        let wgPrivateKey = router.wgPrivateKey;
        let wgPublicKey = router.wgPublicKey;
        let wgPeerPublicKey = router.wgPeerPublicKey;
        let wgPresharedKey = router.wgPresharedKey;
        let tunnelIp = router.wgTunnelIp;

        const configuredServerPublicKey = process.env.WG_SERVER_PUBLIC_KEY;

        const wgServerIp = await wireguardManager.getServerIp();
        const subnetPrefix = wgServerIp.split('.').slice(0, 3).join('.'); // e.g. "10.0.0"

        // Logic to assign a unique Tunnel IP based on server's subnet
        if (!tunnelIp || !tunnelIp.startsWith(`${subnetPrefix}.`)) {
            const allWgRouters = await prisma.router.findMany({
                where: { id: { not: id }, wgTunnelIp: { not: null } },
                select: { wgTunnelIp: true }
            });
            const usedIps = allWgRouters.map(r => r.wgTunnelIp);

            // Find first free IP from 200 to 250
            let nextIp = 200;
            while (usedIps.includes(`${subnetPrefix}.${nextIp}`) && nextIp < 250) {
                nextIp++;
            }
            tunnelIp = `${subnetPrefix}.${nextIp}`;
            await updateRouterWgFields(id, { wgTunnelIp: tunnelIp });
        }

        if (!wgPrivateKey) {
            try {
                wgPrivateKey = await wireguardManager.generatePrivateKey();
                wgPublicKey = await wireguardManager.derivePublicKey(wgPrivateKey);
                wgPeerPublicKey = configuredServerPublicKey || await wireguardManager.getServerPublicKey();
                wgPresharedKey = await wireguardManager.generatePrivateKey(); // Preshared keys use the same 32-byte format
            } catch (err) {
                console.error("Failed to generate WireGuard keys", err);
                return errorResponse("Failed to generate WireGuard keys", 500);
            }

            if (!wgPeerPublicKey) {
                return errorResponse("WireGuard server public key is not configured", 500);
            }

            await updateRouterWgFields(id, {
                wgPrivateKey,
                wgPublicKey,
                wgPeerPublicKey,
                wgPresharedKey,
                wgTunnelIp: tunnelIp, // Save assigned IP
            });
        }

        // Always ensure the peer public key is correct, even if keys were already generated
        const realServerPubKey = await wireguardManager.getServerPublicKey();
        const currentServerPublicKey = realServerPubKey || configuredServerPublicKey;
        if (!currentServerPublicKey) {
            return errorResponse("WireGuard server public key is not configured", 500);
        }

        if (wgPeerPublicKey !== currentServerPublicKey) {
            wgPeerPublicKey = currentServerPublicKey;
            await updateRouterWgFields(id, { wgPeerPublicKey });
        }

        const serverTunnelIp = wgServerIp; // Use actual interface IP
        const listenPort = router.wgListenPort || 51820;

        // Use request host as fallback if no endpoint is configured
        const requestHost = req.headers.get("host")?.split(":")[0];
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || requestHost || "vpn.billing-system.local";
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        // Live tunnel status — check if the MikroTik peer has an active WireGuard handshake
        let tunnelActive = false;
        let lastHandshakeSeconds: number | null = null;
        try {
            const peers = await wireguardManager.listPeers();
            const peer = peers.find(p => p.publicKey === wgPublicKey);
            if (peer && peer.latestHandshake && peer.latestHandshake !== '0') {
                const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(peer.latestHandshake);
                lastHandshakeSeconds = ageSeconds;
                tunnelActive = ageSeconds < 180; // active if handshake < 3 minutes ago
            }
        } catch {
            // wg not available or no peers — not fatal
        }

        return jsonResponse({
            routerId: id,
            routerName: router.name,
            routerHost: router.host,
            enabled: router.wgEnabled || false,
            configuredAt: router.wgConfiguredAt,

            routerPrivateKey: wgPrivateKey,
            routerPublicKey: wgPublicKey,
            serverPublicKey: wgPeerPublicKey,
            presharedKey: wgPresharedKey,

            routerTunnelIp: tunnelIp,
            serverTunnelIp,
            listenPort,
            serverEndpoint,
            serverPort,

            // Live tunnel health
            tunnelActive,
            lastHandshakeSeconds,
            tunnelStatusMessage: tunnelActive
                ? `Tunnel active (last handshake ${lastHandshakeSeconds}s ago)`
                : router.wgEnabled
                    ? `Tunnel configured but MikroTik has not connected yet. Apply config on MikroTik and ensure WireGuard UDP 51820 is open.`
                    : `WireGuard not yet activated`,
        });
    } catch (err: any) {
        console.error("WireGuard config error:", err);
        return errorResponse("Failed to get WireGuard config", 500);
    }
}

// ── POST /api/routers/[id]/wireguard — Activate WireGuard & configure ──────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const body = await req.json();
        const action = body.action || "activate";

        const router = await getRouterWgFields(id);
        if (!router) return errorResponse("Router not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to modify this router", 403);
        }

        if (action === "deactivate") {
            try {
                if (router.wgPublicKey) {
                    await wireguardManager.removePeer(router.wgPublicKey);
                }
            } catch (err) {
                console.error("Failed to remove wireguard peer:", err);
            }

            await updateRouterWgFields(id, { wgEnabled: false });

            await prisma.routerLog.create({
                data: {
                    routerId: id,
                    action: "wireguard_deactivated",
                    details: `WireGuard VPN deactivated for ${router.name}`,
                    status: "success",
                },
            });

            return jsonResponse({ success: true, message: "WireGuard deactivated" });
        }

        // reset-host: restore the router's host back to its original public IP so it's reachable again
        if (action === "reset-host") {
            const newHost = body.host;
            if (!newHost) return errorResponse("Provide the original public IP as 'host' in the request body", 400);

            await updateRouterWgFields(id, { host: newHost });
            // Also update via Prisma so it's reflected everywhere
            await prisma.router.update({ where: { id }, data: { host: newHost, status: "OFFLINE" } });

            await prisma.routerLog.create({
                data: {
                    routerId: id,
                    action: "wireguard_host_reset",
                    details: `Router host reset to ${newHost} by Admin ID: ${userPayload.userId}. WireGuard tunnel was unreachable.`,
                    status: "success",
                },
            });

            return jsonResponse({
                success: true,
                message: `Router host reset to ${newHost}. You can now test the connection using the original IP.`,
            });
        }

        // Ensure keys exist
        if (!router.wgPrivateKey || !router.wgPublicKey) {
            return errorResponse("WireGuard keys not generated. Open config first.", 400);
        }

        const wgServerIp = await wireguardManager.getServerIp();
        const subnetPrefix = wgServerIp.split('.').slice(0, 3).join('.');

        let tunnelIp = router.wgTunnelIp;
        if (!tunnelIp || !tunnelIp.startsWith(`${subnetPrefix}.`)) {
            tunnelIp = `${subnetPrefix}.200`; // Fallback
        }

        // Derive LAN gateway from the router's VPN tunnel IP
        const lanGateway   = tunnelIp;                                         // e.g. 10.0.0.201
        const lanPrefix2   = tunnelIp.split('.').slice(0, 3).join('.');        // e.g. "10.0.0"
        const lanCidr      = `${lanGateway}/24`;                               // e.g. "10.0.0.201/24"
        const lanNetwork   = `${lanPrefix2}.0/24`;                             // e.g. "10.0.0.0/24"
        const lanPoolStart = `${lanPrefix2}.10`;
        const lanPoolEnd   = `${lanPrefix2}.254`;
        const listenPort = router.wgListenPort || 51820;

        // Use request host as fallback if no endpoint is configured (match GET logic)
        const requestHost = req.headers.get("host")?.split(":")[0];
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || requestHost || "vpn.billing-system.local";
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        if (action === "push-config") {
            try {
                const service = await getMikroTikService(id, userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);

                console.log(`[PUSH-CONFIG] Starting unified config for router: ${router.name}`);

                // ──────────────────────────────────────────────────────────
                // STEP 0: CLEANUP OLD HQINVESTMENT RULES & CONFIGS (NO DUPLICATES!)
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Cleaning up old HQInvestment configs...");

                try {
                    const oldFilterRules = await service.apiRequestPublic("/ip/firewall/filter");
                    if (Array.isArray(oldFilterRules)) {
                        for (const rule of oldFilterRules) {
                            if (rule.comment?.includes("HQInvestment")) {
                                try {
                                    await service.apiRequestPublic(`/ip/firewall/filter/${rule[".id"]}`, "DELETE");
                                } catch { }
                            }
                        }
                    }
                } catch { }

                try {
                    const oldNatRules = await service.apiRequestPublic("/ip/firewall/nat");
                    if (Array.isArray(oldNatRules)) {
                        for (const rule of oldNatRules) {
                            if (rule.comment?.includes("HQInvestment")) {
                                try {
                                    await service.apiRequestPublic(`/ip/firewall/nat/${rule[".id"]}`, "DELETE");
                                } catch { }
                            }
                        }
                    }
                } catch { }

                try {
                    const oldRoutes = await service.apiRequestPublic("/ip/route");
                    if (Array.isArray(oldRoutes)) {
                        for (const route of oldRoutes) {
                            if (route.comment?.includes("HQInvestment")) {
                                try {
                                    await service.apiRequestPublic(`/ip/route/${route[".id"]}`, "DELETE");
                                } catch { }
                            }
                        }
                    }
                } catch { }

                try {
                    const oldAddresses = await service.apiRequestPublic("/ip/address");
                    if (Array.isArray(oldAddresses)) {
                        for (const addr of oldAddresses) {
                            if (addr.comment?.includes("HQInvestment")) {
                                try {
                                    await service.apiRequestPublic(`/ip/address/${addr[".id"]}`, "DELETE");
                                } catch { }
                            }
                        }
                    }
                } catch { }

                // ──────────────────────────────────────────────────────────
                // STEP 1: BASIC SETUP (User, Identity, DNS, NTP
                // ──────────────────────────────────────────────────────────
                try {
                    // Get current users
                    const users = await service.apiRequestPublic("/user");
                    if (Array.isArray(users)) {
                        const existingUser = users.find((u: any) => u.name === "admin" || u.name === (router.username || "admin"));
                        if (existingUser) {
                            await service.apiRequestPublic("/user", "PATCH", {
                                ".id": existingUser[".id"],
                                name: router.username || "admin",
                                password: router.password || "admin"
                            });
                        } else {
                            await service.apiRequestPublic("/user", "PUT", {
                                name: router.username || "admin",
                                password: router.password || "admin",
                                group: "full",
                                comment: "Management User - DO NOT DELETE"
                            });
                        }
                    }
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("User note:", e.message); }

                try {
                    await service.apiRequestPublic("/system/identity", "PATCH", { name: router.name });
                } catch (e: any) { console.warn("Identity note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/dns", "PATCH", {
                        servers: "8.8.8.8,8.8.4.4",
                        "allow-remote-requests": "yes"
                    });
                } catch (e: any) { console.warn("DNS note:", e.message); }

                try {
                    await service.apiRequestPublic("/system/ntp/client", "PATCH", {
                        enabled: "yes",
                        servers: "pool.ntp.org"
                    });
                } catch (e: any) { console.warn("NTP note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 2: BRIDGE + HOTSPOT + PPPOE + DHCP
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up Bridge, Hotspot & PPPoE...");

                let lanBridgeName = "bridge-lan";
                let bridgeExists = false;

                try {
                    const bridges = await service.apiRequestPublic("/interface/bridge");
                    if (Array.isArray(bridges) && bridges.length > 0) {
                        // Skip WAN/uplink bridges — find a LAN bridge
                        const lanBridge = bridges.find((b: any) =>
                            b.name !== "wan" &&
                            b.name !== "wan-bridge" &&
                            b.name !== "wan-local" &&
                            !b.name.toLowerCase().startsWith("wan")
                        );
                        if (lanBridge) {
                            lanBridgeName = lanBridge.name;
                            bridgeExists = true;
                            console.log(`[PUSH-CONFIG] Found existing LAN bridge: ${lanBridgeName}`);
                        }
                    }
                } catch (e: any) {
                    console.warn("Failed to get bridges, will use bridge-lan");
                }

                if (!bridgeExists) {
                    try {
                        await service.apiRequestPublic("/interface/bridge", "PUT", {
                            name: lanBridgeName,
                            // Disable STP (Spanning Tree) to prevent 30-second port-up delays
                            // that break hotspot login for newly connected clients
                            "protocol-mode": "none",
                            "stp": "no",
                            comment: "HQInvestment LAN Bridge - Hotspot & PPPoE"
                        });
                    } catch (e: any) { if (!e.message?.includes("already")) console.warn("Bridge note:", e.message); }
                } else {
                    // Disable STP on existing bridge too
                    try {
                        const bridgeList = await service.apiRequestPublic("/interface/bridge");
                        const existing = Array.isArray(bridgeList) ? bridgeList.find((b: any) => b.name === lanBridgeName) : null;
                        if (existing?.[".id"]) {
                            await service.apiRequestPublic(`/interface/bridge/${existing[".id"]}`, "PATCH", {
                                "protocol-mode": "none", "stp": "no"
                            });
                        }
                    } catch { }
                }

                // Sanitize name for RouterOS identifiers using shared lib function
                const safeRouterName      = sanitizeMikroTikName(router.name);
                const safeRouterNameLower = sanitizeMikroTikName(router.name.toLowerCase());

                const hotspotProfileName = `hsprof-${safeRouterNameLower}`;

                try {
                    // SECURITY: Do NOT include 'mac' or 'mac-cookie' in login-by.
                    // 'mac' login allows any device to get internet without a voucher by spoofing a known MAC.
                    // 'cookie' is safe — it only works AFTER a successful login (sets an auth cookie).
                    await service.apiRequestPublic("/ip/hotspot/profile", "PUT", {
                        name: hotspotProfileName,
                        "hotspot-address": lanGateway,
                        "dns-name": `${safeRouterNameLower}.hotspot`,
                        "html-directory": "hotspot",
                        "login-by": "http-chap,http-pap,cookie",
                        "http-cookie-lifetime": "3d",
                        "use-radius": "yes"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Hotspot profile note:", e.message); }

                // SECURITY: Enforce use-radius=yes AND remove 'mac' from login-by on ALL existing profiles.
                // A previously misconfigured profile with login-by=mac allows unauthenticated internet access.
                try {
                    const existingProfiles = await service.apiRequestPublic("/ip/hotspot/profile");
                    if (Array.isArray(existingProfiles)) {
                        for (const prof of existingProfiles) {
                            const needsUpdate =
                                prof["use-radius"] !== "yes" ||
                                (prof["login-by"] || "").includes("mac");
                            if (needsUpdate) {
                                await service.apiRequestPublic(`/ip/hotspot/profile/${prof[".id"]}`, "PATCH", {
                                    "use-radius": "yes",
                                    "login-by": "http-chap,http-pap,cookie"
                                });
                                console.log(`[PUSH-CONFIG] Secured hotspot profile: ${prof.name} (use-radius=yes, removed mac login-by)`);
                            }
                        }
                    }
                } catch (e: any) { console.warn("Hotspot profile security enforce note:", e.message); }

                // Use separate pool ranges for Hotspot and PPPoE to prevent IP collisions
                // Hotspot clients: .10 – .149  |  PPPoE clients: .150 – .250
                const hsPoolStart  = `${lanPrefix2}.10`;
                const hsPoolEnd    = `${lanPrefix2}.149`;
                const ppoePoolStart = `${lanPrefix2}.150`;
                const ppoePoolEnd   = `${lanPrefix2}.250`;

                try {
                    await service.apiRequestPublic("/ip/pool", "PUT", {
                        name: `hs-pool-${safeRouterName}`,
                        ranges: `${hsPoolStart}-${hsPoolEnd}`
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("HS pool note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/pool", "PUT", {
                        name: `pppoe-pool-${safeRouterName}`,
                        ranges: `${ppoePoolStart}-${ppoePoolEnd}`
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("PPPoE pool note:", e.message); }

                // STEP 2a: IP address on bridge MUST come before hotspot creation.
                // RouterOS requires hotspot-address to already exist on the interface.
                try {
                    await service.apiRequestPublic("/ip/address", "PUT", {
                        address: lanCidr,
                        interface: lanBridgeName,
                        comment: "HQInvestment Hotspot LAN"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("HS IP note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/dhcp-server/network", "PUT", {
                        address: lanNetwork,
                        gateway: lanGateway,
                        "dns-server": "8.8.8.8,1.1.1.1"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("DHCP network note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/dhcp-server", "PUT", {
                        name: `dhcp-${safeRouterName}`,
                        interface: lanBridgeName,
                        "address-pool": `hs-pool-${safeRouterName}`,
                        "lease-time": "1h",
                        disabled: "no"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("DHCP server note:", e.message); }

                // Hotspot created AFTER IP address is confirmed on bridge
                try {
                    await service.apiRequestPublic("/ip/hotspot", "PUT", {
                        name: `hotspot-${safeRouterName}`,
                        interface: lanBridgeName,
                        "address-pool": `hs-pool-${safeRouterName}`,
                        profile: hotspotProfileName,
                        disabled: "no"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Hotspot note:", e.message); }

                try {
                    await service.apiRequestPublic("/ppp/profile", "PUT", {
                        name: `pppoe-profile-${safeRouterName}`,
                        "local-address": lanGateway,
                        "remote-address": `pppoe-pool-${safeRouterName}`,
                        "dns-server": "8.8.8.8,1.1.1.1",
                        "use-encryption": "yes"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("PPPoE profile note:", e.message); }

                try {
                    await service.apiRequestPublic("/ppp/aaa", "PATCH", {
                        "use-radius": "yes",
                        "accounting": "yes"
                    });
                } catch (e: any) { console.warn("PPP AAA note:", e.message); }

                try {
                    await service.apiRequestPublic("/interface/pppoe-server/server", "PUT", {
                        "service-name": `pppoe-svc-${safeRouterName}`,
                        interface: lanBridgeName,
                        "default-profile": `pppoe-profile-${safeRouterName}`,
                        "one-session-per-host": "yes",
                        disabled: "no"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("PPPoE server note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 3: WIREGUARD VPN
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up WireGuard...");

                // Add peer to the Server's WireGuard interface FIRST to avoid race condition
                // (If Mikrotik tries to connect before the server expects it, handshake fails)
                try {
                    await wireguardManager.addPeer(router.wgPublicKey, tunnelIp, router.wgPresharedKey || undefined);
                } catch (e: any) {
                    console.error("Failed to add peer to wg0:", e.message);
                }


                try {
                    await service.apiRequestPublic("/interface/wireguard", "PUT", {
                        name: "wg-hq",
                        "listen-port": String(listenPort),
                        "private-key": router.wgPrivateKey,
                        disabled: "no",
                        comment: "HQInvestment VPN Interface"
                    });
                } catch (e: any) {
                    if (!e.message?.includes("already")) {
                        try {
                            const wgInterfaces = await service.apiRequestPublic("/interface/wireguard");
                            if (Array.isArray(wgInterfaces)) {
                                const existing = wgInterfaces.find((i: any) => i.name === "wg-hq");
                                if (existing?.[".id"]) {
                                    await service.apiRequestPublic("/interface/wireguard", "PATCH", {
                                        ".id": existing[".id"],
                                        "private-key": router.wgPrivateKey
                                    });
                                }
                            }
                        } catch { }
                    } else {
                        throw e;
                    }
                }

                try {
                    await service.apiRequestPublic("/ip/address", "PUT", {
                        address: `${tunnelIp}/24`,
                        interface: "wg-hq",
                        network: `${subnetPrefix}.0`,
                        comment: "HQInvestment VPN Address"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("WG IP note:", e.message); }

                try {
                    const oldPeers = await service.apiRequestPublic("/interface/wireguard/peers");
                    if (Array.isArray(oldPeers)) {
                        for (const peer of oldPeers) {
                            if (peer.comment?.includes("HQInvestment") || peer.interface === "wg-hq") {
                                try {
                                    await service.apiRequestPublic(`/interface/wireguard/peers/${peer[".id"]}`, "DELETE");
                                } catch { }
                            }
                        }
                    }
                } catch { }

                try {
                    // allowed-address = VPN subnet ONLY (not 0.0.0.0/0).
                    // Routing ALL traffic through the tunnel would break internet for hotspot clients
                    // and overload the server. Only management/RADIUS traffic uses the VPN.
                    // Preshared key adds an extra layer of symmetric encryption to the handshake.
                    await service.apiRequestPublic("/interface/wireguard/peers", "PUT", {
                        interface: "wg-hq",
                        "public-key": router.wgPeerPublicKey,
                        ...(router.wgPresharedKey ? { "preshared-key": router.wgPresharedKey } : {}),
                        "allowed-address": `${subnetPrefix}.0/24`,
                        "endpoint-address": serverEndpoint,
                        "endpoint-port": String(serverPort),
                        "persistent-keepalive": "25s",
                        comment: "HQInvestment ISP Server",
                    });
                } catch (e: any) { console.warn("Peer note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 4: FIREWALL RULES (COMPLETE HOTSPOT PROTECTION!)
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up Firewall...");

                const restPort = router.apiPort || (router.port === 8728 || router.port === 8729 ? 80 : router.port) || 80;

                // ── FIREWALL RULES ────────────────────────────────────────────────
                // IMPORTANT: The "Allow Hotspot to Internet" forward rule is intentionally
                // ABSENT. The MikroTik Hotspot engine intercepts all traffic from the bridge
                // and only forwards it to WAN AFTER successful authentication (voucher/payment).
                // Adding an unconditional forward rule here would bypass authentication entirely,
                // allowing any device to get free internet access.
                const firewallRules = [
                    // ── INPUT CHAIN: allow management & services ──
                    { chain: "input", protocol: "udp", "dst-port": String(listenPort), action: "accept", comment: "Allow WireGuard - HQInvestment" },
                    { chain: "input", protocol: "icmp", "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow ICMP from VPN - HQInvestment" },
                    { chain: "input", protocol: "tcp", "dst-port": String(restPort), "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow REST API from VPN - HQInvestment" },
                    { chain: "input", protocol: "tcp", "dst-port": "8291", "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow Winbox from VPN - HQInvestment" },
                    { chain: "input", protocol: "udp", "dst-port": "3799", "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow RADIUS CoA from VPN - HQInvestment" },
                    { chain: "input", protocol: "tcp", "dst-port": "80,443", "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow Web from VPN - HQInvestment" },
                    { chain: "input", protocol: "udp", "dst-port": "53,67", "in-interface": lanBridgeName, action: "accept", comment: "Allow DNS & DHCP from LAN - HQInvestment" },
                    { chain: "input", protocol: "icmp", action: "accept", comment: "Allow Ping - HQInvestment" },
                    { chain: "input", "connection-state": "established,related", action: "accept", comment: "Allow Established Input - HQInvestment" },
                    { chain: "input", "in-interface": lanBridgeName, protocol: "tcp", "dst-port": "80,443", action: "accept", comment: "Allow Hotspot Captive Portal - HQInvestment" },
                    { chain: "input", "in-interface": lanBridgeName, protocol: "udp", "dst-port": "67", action: "accept", comment: "Allow Hotspot DHCP - HQInvestment" },
                    { chain: "input", "in-interface": lanBridgeName, protocol: "udp", "dst-port": "53", action: "accept", comment: "Allow Hotspot DNS - HQInvestment" },
                    // ── FORWARD CHAIN: authenticated PPPoE only ──
                    // NOTE: Hotspot-authenticated forward is handled automatically by the hotspot
                    // engine. Do NOT add a blanket bridge->ether1 accept rule here!
                    { chain: "forward", "in-interface": "all-ppp", "out-interface": "ether1", action: "accept", comment: "Allow PPPoE to Internet - HQInvestment" },
                    { chain: "forward", "connection-state": "established,related", action: "accept", comment: "Allow Established Forward - HQInvestment" },
                    { chain: "forward", "in-interface": "wg-hq", action: "accept", comment: "Allow WG traffic - HQInvestment" },
                    { chain: "forward", "out-interface": "wg-hq", action: "accept", comment: "Allow WG return - HQInvestment" },
                    // ── DROP RULES: must come LAST (lowest priority) ──
                    { chain: "input", "in-interface": "ether1", action: "drop", comment: "Drop WAN input - HQInvestment" },
                    // SECURITY: Block unauthenticated LAN/bridge clients from reaching WAN.
                    // The Hotspot engine creates DYNAMIC accept rules for authenticated users, so
                    // authenticated clients are NOT affected by this drop rule.
                    // PPPoE clients use the all-ppp forward rule above and are also unaffected.
                    { chain: "forward", "in-interface": lanBridgeName, "out-interface": "ether1", action: "drop", comment: "Drop unauthenticated LAN forward - HQInvestment" },
                ];

                // Reverse the array so that by putting them at index 0, they end up in the correct order at the very top.
                const reversedRules = [...firewallRules].reverse();

                for (const rule of reversedRules) {
                    try {
                        await service.apiRequestPublic("/ip/firewall/filter", "PUT", { ...rule, "place-before": "0" });
                    } catch (e: any) { console.warn("FW note:", e.message); }
                }

                // ──────────────────────────────────────────────────────────
                // STEP 5: NAT (FIXED CONFLICT! - ONLY ETHER1!)
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up NAT...");

                try {
                    await service.apiRequestPublic("/ip/firewall/nat", "PUT", {
                        chain: "srcnat", "out-interface": "ether1",
                        action: "masquerade", comment: "NAT for Internet - HQInvestment", "place-before": "0"
                    });
                } catch (e: any) { console.warn("NAT note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 6: ROUTE
                // ──────────────────────────────────────────────────────────
                try {
                    await service.apiRequestPublic("/ip/route", "PUT", {
                        "dst-address": `${subnetPrefix}.0/24`, gateway: "wg-hq",
                        comment: "WireGuard route - HQInvestment"
                    });
                } catch (e: any) { console.warn("Route note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 7: RADIUS & CoA
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up RADIUS...");
                try {
                    // Remove old radius configs matching old server IPs
                    const oldRadius = await service.apiRequestPublic("/radius");
                    if (Array.isArray(oldRadius)) {
                        for (const r of oldRadius) {
                            if (r.comment?.includes("HQInvestment") || r.comment?.includes("HQInvestment RADIUS")) {
                                try { await service.apiRequestPublic(`/radius/${r[".id"]}`, "DELETE"); } catch {}
                            }
                        }
                    }
                } catch {}

                try {
                    await service.apiRequestPublic("/radius", "PUT", {
                        address: wgServerIp,
                        secret: process.env.RADIUS_NAS_SECRET || router.password || 'hqinvestment_radius_secret',
                        service: "hotspot,ppp",
                        "authentication-port": "1812",
                        "accounting-port": "1813",
                        timeout: "3000ms",
                        "src-address": tunnelIp,
                        comment: "HQInvestment RADIUS"
                    });
                } catch (e: any) { console.warn("Radius note:", e.message); }

                try {
                    await service.apiRequestPublic("/radius/incoming", "PATCH", {
                        accept: "yes",
                        port: "3799"
                    });
                } catch (e: any) { console.warn("Radius incoming note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 7b: WALLED GARDEN — allow billing portal BEFORE login
                // Without this, clients cannot reach the payment page to buy
                // a voucher or pay via mobile money.
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up Walled Garden...");
                const billingHost = process.env.WG_SERVER_ENDPOINT || process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') || wgServerIp;
                const billingHostClean = billingHost.split(':')[0]; // strip port if any

                try {
                    // Remove old walled garden entries created by HQInvestment
                    const oldWg = await service.apiRequestPublic("/ip/hotspot/walled-garden");
                    if (Array.isArray(oldWg)) {
                        for (const entry of oldWg) {
                            if (entry.comment?.includes("HQInvestment")) {
                                try { await service.apiRequestPublic(`/ip/hotspot/walled-garden/${entry[".id"]}`, "DELETE"); } catch {}
                            }
                        }
                    }
                } catch {}

                try {
                    const oldWgIp = await service.apiRequestPublic("/ip/hotspot/walled-garden/ip");
                    if (Array.isArray(oldWgIp)) {
                        for (const entry of oldWgIp) {
                            if (entry.comment?.includes("HQInvestment")) {
                                try { await service.apiRequestPublic(`/ip/hotspot/walled-garden/ip/${entry[".id"]}`, "DELETE"); } catch {}
                            }
                        }
                    }
                } catch {}

                // Allow billing portal domain (DNS-based) - unauthenticated clients can reach it
                try {
                    await service.apiRequestPublic("/ip/hotspot/walled-garden", "PUT", {
                        "dst-host": billingHostClean,
                        action: "allow",
                        comment: "Billing Portal - HQInvestment"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Walled garden DNS note:", e.message); }

                // Allow billing portal IP (IP-based) - ensures portal works even if DNS fails
                try {
                    await service.apiRequestPublic("/ip/hotspot/walled-garden/ip", "PUT", {
                        "dst-address": wgServerIp,
                        action: "accept",
                        comment: "Billing Portal IP - HQInvestment"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Walled garden IP note:", e.message); }

                // Allow VPN subnet access from unauthenticated clients (needed for RADIUS)
                try {
                    await service.apiRequestPublic("/ip/hotspot/walled-garden/ip", "PUT", {
                        "dst-address": `${subnetPrefix}.0/24`,
                        action: "accept",
                        comment: "VPN Subnet - HQInvestment"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Walled garden VPN note:", e.message); }

                // Verification Step: Wait for tunnel to establish, then check real handshake
                // We wait up to 15 seconds to allow Mikrotik to retry handshake if needed
                await new Promise(resolve => setTimeout(resolve, 15000));
                const tunnelVerified = await wireguardManager.checkPeerHandshake(router.wgPublicKey);

                // Update router state
                const updateData: Record<string, any> = {
                    wgEnabled: true,
                    wgConfiguredAt: new Date(),
                };
                // Only switch host to tunnel IP if the MikroTik actually connected back
                if (tunnelVerified) {
                    updateData.host = tunnelIp;
                } else {
                    console.warn(`[WireGuard] Peer ${tunnelIp} has not completed handshake yet. Keeping current host IP.`);
                }
                await updateRouterWgFields(id, updateData);

                await prisma.routerLog.create({
                    data: {
                        routerId: id,
                        action: "wireguard_pushed",
                        details: `WireGuard config auto-pushed to ${router.name}.${tunnelVerified ? ` Connection switched to tunnel IP ${tunnelIp}.` : " Tunnel verification failed - keeping current host."}`,
                        status: "success",
                    },
                });

                return jsonResponse({
                    success: true,
                    message: tunnelVerified
                        ? `WireGuard configured and assumed reachable on ${router.name}. Tunnel IP: ${tunnelIp}.`
                        : `WireGuard configured on ${router.name}, but tunnel verification failed. Keeping original host IP for now.`,
                    tunnelVerified,
                });

            } catch (err: any) {
                await prisma.routerLog.create({
                    data: {
                        routerId: id,
                        action: "wireguard_push_failed",
                        details: `Failed to push WireGuard config: ${err.message}`,
                        status: "error",
                    },
                });
                return jsonResponse({
                    success: false,
                    message: "Failed to auto-configure. Ensure the router is reachable and try manual setup.",
                }, 200);
            }
        }

        // Default: manual activate (user pasted the script on MikroTik)
        try {
            // Aggressive Cleanup: Remove any peer that is not actively registered in the DB
            const allValidRouters = await prisma.router.findMany({
                where: { wgPublicKey: { not: null } },
                select: { wgPublicKey: true }
            });
            const validKeys = new Set(allValidRouters.map(r => r.wgPublicKey));

            const allPeers = await wireguardManager.listPeers();
            for (const peer of allPeers) {
                // Keep the current router being activated
                if (peer.publicKey === router.wgPublicKey) continue;

                // If peer is not in the database, OR it has lost its allowed IP, destroy it
                if (!validKeys.has(peer.publicKey) || peer.allowedIps === "(none)") {
                    await wireguardManager.removePeer(peer.publicKey);
                }
            }

            await wireguardManager.addPeer(router.wgPublicKey, tunnelIp, router.wgPresharedKey || undefined);
        } catch (err: any) {
            console.error("Failed to add peer:", err);
            return errorResponse("Failed to add peer to server", 500);
        }

        // Wait a few seconds for MikroTik to complete the WireGuard handshake
        await new Promise(resolve => setTimeout(resolve, 8000));
        const peerConnected = await wireguardManager.checkPeerHandshake(router.wgPublicKey);

        const activateData: Record<string, any> = {
            wgEnabled: true,
            wgConfiguredAt: new Date(),
        };

        let pingResult = "Ping not attempted";
        let responseMessage: string;

        if (peerConnected) {
            // Only switch host to tunnel IP once tunnel is actually confirmed
            activateData.host = tunnelIp;
            try {
                const { stdout } = await execAsync(`ping -c 3 -W 3 ${tunnelIp}`);
                pingResult = stdout;
            } catch (err: any) {
                pingResult = err.message || "Ping failed";
            }
            responseMessage = `WireGuard tunnel established! Router is now accessible via tunnel IP ${tunnelIp}. Ping result:\n${pingResult.substring(0, 150)}`;
            console.log(`[WireGuard] Activate: peer ${tunnelIp} connected. Switching host to tunnel IP.`);
        } else {
            // Handshake not confirmed — keep original host to preserve connectivity
            console.warn(`[WireGuard] Activate: peer ${tunnelIp} has NOT completed a WireGuard handshake. Keeping original host IP to preserve connectivity.`);
            responseMessage = `WireGuard peer registered on server, but MikroTik has NOT connected yet (no handshake).\n\nTo fix:\n1. Verify the config was pasted correctly on MikroTik.\n2. Check UDP port ${listenPort} is open on MikroTik (firewall rule must be above any DROP rule).\n3. Run on Droplet: sudo wg show wg0\n4. Once the MikroTik peer appears with a handshake, click Activate again.`;
        }

        await updateRouterWgFields(id, activateData);

        await prisma.routerLog.create({
            data: {
                routerId: id,
                action: "wireguard_activated",
                details: `WireGuard activation for ${router.name}. Tunnel ${peerConnected ? 'verified — host switched to ' + tunnelIp : 'NOT yet connected — original host preserved'}.`,
                status: "success",
            },
        });

        return jsonResponse({
            success: peerConnected,
            tunnelVerified: peerConnected,
            message: responseMessage,
        });
    } catch (err: any) {
        console.error("WireGuard activate error:", err);
        return errorResponse("Failed to activate WireGuard", 500);
    }
}
