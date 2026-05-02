import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { wireguardManager } from "@/lib/wireguard";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

// ── Raw SQL helpers (bypass Prisma client validation for new fields) ────────

async function getRouterWgFields(routerId: string) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT "wgPrivateKey", "wgPublicKey", "wgPeerPublicKey", "wgPresharedKey",
                "wgTunnelIp", "wgServerEndpoint", "wgListenPort", "wgEnabled", "wgConfiguredAt",
                "host", "name", "id", "tenantId"
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
        const listenPort = router.wgListenPort || 51820;

        // Use request host as fallback if no endpoint is configured (match GET logic)
        const requestHost = req.headers.get("host")?.split(":")[0];
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || requestHost || "vpn.billing-system.local";
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        if (action === "push-config") {
            try {
                const service = await getMikroTikService(id, userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);
                const routerIdCode = `MYR-${router.id.padStart(3, '0')}VBHBC`;

                console.log(`[PUSH-CONFIG] Starting unified config for router: ${router.name}`);

                // ──────────────────────────────────────────────────────────
                // STEP 0: CLEANUP OLD KENGE RULES & CONFIGS (NO DUPLICATES!)
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Cleaning up old Kenge configs...");

                try {
                    const oldFilterRules = await service.apiRequestPublic("/ip/firewall/filter");
                    if (Array.isArray(oldFilterRules)) {
                        for (const rule of oldFilterRules) {
                            if (rule.comment?.includes("Kenge")) {
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
                            if (rule.comment?.includes("Kenge")) {
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
                            if (route.comment?.includes("Kenge")) {
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
                            if (addr.comment?.includes("Kenge")) {
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
                        const defaultBridge = bridges.find((b: any) => b.name === "bridge" || b.name === "bridge-local" || b.name === "bridgeLocal");
                        lanBridgeName = defaultBridge ? defaultBridge.name : bridges[0].name;
                        bridgeExists = true;
                        console.log(`[PUSH-CONFIG] Found existing bridge: ${lanBridgeName}`);
                    }
                } catch (e: any) {
                    console.warn("Failed to get bridges, will use bridge-lan");
                }

                if (!bridgeExists) {
                    try {
                        await service.apiRequestPublic("/interface/bridge", "PUT", {
                            name: lanBridgeName,
                            comment: "Kenge LAN Bridge - Hotspot & PPPoE"
                        });
                    } catch (e: any) { if (!e.message?.includes("already")) console.warn("Bridge note:", e.message); }
                    // Note: We deliberately DO NOT forcefully add ether2 to the bridge here.
                    // Doing so breaks existing DHCP servers on ether2 and drops the network.
                }

                const hotspotProfileName = `hsprof-${router.name.toLowerCase().replace(/\s+/g, '-')}`;

                try {
                    await service.apiRequestPublic("/ip/hotspot/profile", "PUT", {
                        name: hotspotProfileName,
                        "hotspot-address": "10.116.0.2",
                        "dns-name": `${router.name.toLowerCase().replace(/\s+/g, '-')}.hotspot`,
                        "html-directory": "hotspot",
                        "login-by": "http-chap,http-pap,cookie,mac-cookie",
                        "http-cookie-lifetime": "3d"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Hotspot profile note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/pool", "PUT", {
                        name: `hs-pool-${router.name}`,
                        ranges: "10.116.0.3-10.116.0.254"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("HS pool note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/hotspot", "PUT", {
                        name: `hotspot-${router.name}`,
                        interface: lanBridgeName,
                        "address-pool": `hs-pool-${router.name}`,
                        profile: hotspotProfileName,
                        disabled: "no"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("Hotspot note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/pool", "PUT", {
                        name: `pppoe-pool-${router.name}`,
                        ranges: "10.116.0.3-10.116.0.254"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("PPPoE pool note:", e.message); }

                try {
                    await service.apiRequestPublic("/ppp/profile", "PUT", {
                        name: `pppoe-profile-${router.name}`,
                        "local-address": "10.116.0.2",
                        "remote-address": `pppoe-pool-${router.name}`,
                        "dns-server": "8.8.8.8,1.1.1.1",
                        "use-encryption": "yes"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("PPPoE profile note:", e.message); }

                try {
                    await service.apiRequestPublic("/interface/pppoe-server/server", "PUT", {
                        "service-name": `pppoe-svc-${router.name}`,
                        interface: lanBridgeName,
                        "default-profile": `pppoe-profile-${router.name}`,
                        disabled: "no"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("PPPoE server note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/address", "PUT", {
                        address: "10.116.0.2/24",
                        interface: lanBridgeName,
                        comment: "Kenge Hotspot LAN"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("HS IP note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/dhcp-server/network", "PUT", {
                        address: "10.116.0.0/24",
                        gateway: "10.116.0.2",
                        "dns-server": "10.116.0.2"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("DHCP network note:", e.message); }

                try {
                    await service.apiRequestPublic("/ip/dhcp-server", "PUT", {
                        name: `dhcp-${router.name}`,
                        interface: lanBridgeName,
                        "address-pool": `hs-pool-${router.name}`,
                        disabled: "no"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("DHCP server note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 3: WIREGUARD VPN
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up WireGuard...");

                // Add peer to the Server's WireGuard interface FIRST to avoid race condition
                // (If Mikrotik tries to connect before the server expects it, handshake fails)
                try {
                    await wireguardManager.addPeer(router.wgPublicKey, tunnelIp);
                } catch (e: any) {
                    console.error("Failed to add peer to wg0:", e.message);
                }


                try {
                    await service.apiRequestPublic("/interface/wireguard", "PUT", {
                        name: "wg-kenge",
                        "listen-port": String(listenPort),
                        "private-key": router.wgPrivateKey,
                        disabled: "no",
                        comment: "Kenge VPN Interface"
                    });
                } catch (e: any) {
                    if (!e.message?.includes("already")) {
                        try {
                            const wgInterfaces = await service.apiRequestPublic("/interface/wireguard");
                            if (Array.isArray(wgInterfaces)) {
                                const existing = wgInterfaces.find((i: any) => i.name === "wg-kenge");
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
                        interface: "wg-kenge",
                        network: `${subnetPrefix}.0`,
                        comment: "Kenge VPN Address"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("WG IP note:", e.message); }

                try {
                    const oldPeers = await service.apiRequestPublic("/interface/wireguard/peers");
                    if (Array.isArray(oldPeers)) {
                        for (const peer of oldPeers) {
                            if (peer.comment?.includes("Kenge") || peer.interface === "wg-kenge") {
                                try {
                                    await service.apiRequestPublic(`/interface/wireguard/peers/${peer[".id"]}`, "DELETE");
                                } catch { }
                            }
                        }
                    }
                } catch { }

                try {
                    await service.apiRequestPublic("/interface/wireguard/peers", "PUT", {
                        interface: "wg-kenge",
                        "public-key": router.wgPeerPublicKey,
                        "allowed-address": `${subnetPrefix}.0/24`,
                        "endpoint-address": serverEndpoint,
                        "endpoint-port": String(serverPort),
                        "persistent-keepalive": "25s",
                        comment: "Kenge ISP Server",
                    });
                } catch (e: any) { console.warn("Peer note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 4: FIREWALL RULES (COMPLETE HOTSPOT PROTECTION!)
                // ──────────────────────────────────────────────────────────
                console.log("[PUSH-CONFIG] Setting up Firewall...");

                const restPort = router.apiPort || (router.port === 8728 || router.port === 8729 ? 80 : router.port) || 80;

                const firewallRules = [
                    { chain: "input", protocol: "udp", "dst-port": String(listenPort), action: "accept", comment: "Allow WireGuard - Kenge" },
                    { chain: "input", protocol: "icmp", "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow ICMP from VPN - Kenge" },
                    { chain: "input", protocol: "tcp", "dst-port": String(restPort), "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow REST API from VPN - Kenge" },
                    { chain: "input", protocol: "tcp", "dst-port": "8291", "src-address": `${subnetPrefix}.0/24`, action: "accept", comment: "Allow Winbox from VPN - Kenge" },
                    { chain: "input", protocol: "tcp", "dst-port": "80,443", action: "accept", comment: "Allow Web - Kenge" },
                    { chain: "input", protocol: "udp", "dst-port": "53,67", action: "accept", comment: "Allow DNS & DHCP - Kenge" },
                    { chain: "input", protocol: "icmp", action: "accept", comment: "Allow Ping - Kenge" },
                    { chain: "input", "connection-state": "established,related", action: "accept", comment: "Allow Established - Kenge" },
                    { chain: "input", "in-interface": lanBridgeName, protocol: "tcp", "dst-port": "80,443", action: "accept", comment: "Allow Hotspot HTTP/HTTPS - Kenge" },
                    { chain: "input", "in-interface": lanBridgeName, protocol: "udp", "dst-port": "67", action: "accept", comment: "Allow Hotspot DHCP - Kenge" },
                    { chain: "input", "in-interface": lanBridgeName, protocol: "udp", "dst-port": "53", action: "accept", comment: "Allow Hotspot DNS - Kenge" },
                    { chain: "forward", "in-interface": lanBridgeName, "out-interface": "ether1", action: "accept", comment: "Allow Hotspot to Internet - Kenge" },
                    { chain: "forward", "in-interface": "ether1", "out-interface": lanBridgeName, "connection-state": "established,related", action: "accept", comment: "Allow Internet to Hotspot - Kenge" },
                    { chain: "forward", "in-interface": "wg-kenge", action: "accept", comment: "Allow WG traffic - Kenge" },
                    { chain: "forward", "out-interface": "wg-kenge", action: "accept", comment: "Allow WG return - Kenge" }
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
                        action: "masquerade", comment: "NAT for Internet - Kenge", "place-before": "0"
                    });
                } catch (e: any) { console.warn("NAT note:", e.message); }

                // ──────────────────────────────────────────────────────────
                // STEP 6: ROUTE
                // ──────────────────────────────────────────────────────────
                try {
                    await service.apiRequestPublic("/ip/route", "PUT", {
                        "dst-address": `${subnetPrefix}.0/24`, gateway: "wg-kenge",
                        comment: "WireGuard route - Kenge"
                    });
                } catch (e: any) { console.warn("Route note:", e.message); }

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

            await wireguardManager.addPeer(router.wgPublicKey, tunnelIp);
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
