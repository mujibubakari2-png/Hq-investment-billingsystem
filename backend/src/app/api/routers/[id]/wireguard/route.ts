import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { wireguardManager } from "@/lib/wireguard";
import crypto from "crypto";
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

        // Server-side keys (for the HQInvestment server)
        // Prevent random generation by using the hardcoded key from setup-vpn.sh as the ultimate fallback
        const DEFAULT_SERVER_PRIVATE_KEY = "mPsn44hz/0c/ZuAREVBTit//tuazXSw5+E9OeeAZS1Q=";
        const DEFAULT_SERVER_PUBLIC_KEY = "b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=";
        
        const serverPrivateKey = process.env.WG_SERVER_PRIVATE_KEY || DEFAULT_SERVER_PRIVATE_KEY;
        const serverPublicKey = process.env.WG_SERVER_PUBLIC_KEY || DEFAULT_SERVER_PUBLIC_KEY;

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
                wgPeerPublicKey = serverPublicKey;
                wgPresharedKey = await wireguardManager.generatePrivateKey(); // Preshared keys use the same 32-byte format
            } catch (err) {
                console.error("Failed to generate real WG keys, using fallback", err);
                wgPrivateKey = crypto.randomBytes(32).toString("base64");
                wgPublicKey = crypto.createHash("sha256").update(wgPrivateKey).digest("base64"); // INSECURE FALLBACK
                wgPeerPublicKey = serverPublicKey;
                wgPresharedKey = crypto.randomBytes(32).toString("base64");
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
        const currentServerPublicKey = realServerPubKey || serverPublicKey;
        
        if (wgPeerPublicKey !== currentServerPublicKey) {
            wgPeerPublicKey = currentServerPublicKey;
            await updateRouterWgFields(id, { wgPeerPublicKey });
        }

        const serverTunnelIp = wgServerIp; // Use actual interface IP
        const listenPort = router.wgListenPort || 13231;
        
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
        return errorResponse(err.message || "Failed to get WireGuard config", 500);
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
        const listenPort = router.wgListenPort || 13231;
        
        // Use request host as fallback if no endpoint is configured (match GET logic)
        const requestHost = req.headers.get("host")?.split(":")[0];
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || requestHost || "vpn.billing-system.local";
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        if (action === "push-config") {
            try {
                const service = await getMikroTikService(id, userPayload.tenantId);

                // Step 0: Initial Setup (Management User, Identity, DNS)
                try {
                    // Create management user
                    await service.apiRequestPublic("/user", "PUT", {
                        name: "admin_kenge",
                        password: router.password || "admin",
                        group: "full",
                        comment: "Management User - DO NOT DELETE"
                    });
                } catch (e: any) { if (!e.message?.includes("already")) console.warn("User note:", e.message); }

                try {
                    // Set system identity
                    await service.apiRequestPublic("/system/identity", "PATCH", {
                        name: router.name
                    });
                } catch (e: any) { console.warn("Identity note:", e.message); }

                try {
                    // Set DNS
                    await service.apiRequestPublic("/ip/dns", "PATCH", {
                        servers: "8.8.8.8,8.8.4.4",
                        "allow-remote-requests": "yes"
                    });
                } catch (e: any) { console.warn("DNS note:", e.message); }

                // Step 1: Create WireGuard interface
                try {
                    await service.apiRequestPublic("/interface/wireguard", "PUT", {
                        name: "wg-kenge",
                        "listen-port": String(listenPort),
                        "private-key": router.wgPrivateKey,
                        comment: "Kenge VPN Interface"
                    });
                } catch (e: any) {
                    if (!e.message?.includes("already")) throw e;
                    // If already exists, we might want to update the private key?
                    // For now, assume it's correct or managed manually.
                }

                // Step 2: Assign IP address
                try {
                    await service.apiRequestPublic("/ip/address", "PUT", {
                        address: `${tunnelIp}/24`,
                        interface: "wg-kenge",
                        network: `${subnetPrefix}.0`,
                        comment: "Kenge VPN Address"
                    });
                } catch (e: any) {
                    if (!e.message?.includes("already")) console.warn("IP note:", e.message);
                }

                // Step 3: Add peer
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
                } catch (e: any) {
                    if (!e.message?.includes("already")) console.warn("Peer note:", e.message);
                }

                // Step 4: Firewall Rules (Input and Forward)
                // Use place-before="0" to ensure rules are at the top of the chain
                const firewallRules = [
                    {
                        chain: "input", protocol: "udp", "dst-port": String(listenPort),
                        action: "accept", comment: "Allow WireGuard - Kenge"
                    },
                    {
                        chain: "forward", "in-interface": "wg-kenge",
                        action: "accept", comment: "Allow WG traffic"
                    },
                    {
                        chain: "forward", "out-interface": "wg-kenge",
                        action: "accept", comment: "Allow WG return traffic"
                    }
                ];

                for (const rule of firewallRules) {
                    try {
                        await service.apiRequestPublic("/ip/firewall/filter", "PUT", rule);
                    } catch (e: any) {
                        // Ignore if exactly the same rule exists (some versions of ROS might allow duplicates if comment is different)
                        console.warn("FW note:", e.message);
                    }
                }

                // Step 5: NAT
                try {
                    await service.apiRequestPublic("/ip/firewall/nat", "PUT", {
                        chain: "srcnat", "out-interface": "wg-kenge",
                        action: "masquerade", comment: "NAT WireGuard - Kenge", "place-before": "0"
                    });
                } catch (e: any) { console.warn("NAT note:", e.message); }

                // Step 6: Route
                try {
                    await service.apiRequestPublic("/ip/route", "PUT", {
                        "dst-address": `${subnetPrefix}.0/24`, gateway: "wg-kenge",
                        comment: "WireGuard subnet route - Kenge",
                    });
                } catch (e: any) { console.warn("Route note:", e.message); }

                // Add peer to the Server's WireGuard interface
                try {
                    await wireguardManager.addPeer(router.wgPublicKey, tunnelIp);
                } catch (e: any) {
                    console.error("Failed to add peer to wg0:", e.message);
                }

                // Verification Step: Wait for tunnel to establish, then check real handshake
                await new Promise(resolve => setTimeout(resolve, 5000));
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
                    message: `Failed to auto-configure: ${err.message}. Ensure the router is reachable and try manual setup.`,
                }, 200);
            }
        }

        // Default: manual activate (user pasted the script on MikroTik)
        try {
            await wireguardManager.addPeer(router.wgPublicKey, tunnelIp);
        } catch (err: any) {
            console.error("Failed to add peer:", err);
            return errorResponse(`Failed to add peer to server: ${err.message}`, 500);
        }

        // Wait a few seconds for MikroTik to complete the WireGuard handshake
        await new Promise(resolve => setTimeout(resolve, 5000));
        const peerConnected = await wireguardManager.checkPeerHandshake(router.wgPublicKey);

        const activateData: Record<string, any> = {
            wgEnabled: true,
            wgConfiguredAt: new Date(),
        };
        // FOR DEBUGGING: Always switch router host to tunnel IP to test actual connectivity
        activateData.host = tunnelIp;
        
        let pingResult = "Ping not attempted";
        try {
            const { stdout } = await execAsync(`ping -c 3 -W 3 ${tunnelIp}`);
            pingResult = stdout;
        } catch (err: any) {
            pingResult = err.message || "Ping failed";
        }

        try {
            const { stdout } = await execAsync(`sudo wg show wg0 dump`);
            pingResult += "\n\nWG Dump:\n" + stdout;
        } catch (err: any) {
            pingResult += "\n\nWG Dump failed: " + err.message;
        }

        if (!peerConnected) {
            console.warn(`[WireGuard] Activate: peer ${tunnelIp} not yet connected (no handshake). Forcing host switch for testing. Ping: ${pingResult}`);
        }
        await updateRouterWgFields(id, activateData);

        await prisma.routerLog.create({
            data: {
                routerId: id,
                action: "wireguard_activated",
                details: `Forced WireGuard activation for ${router.name}. Host switched to ${tunnelIp}. Ping Test: ${pingResult.substring(0, 100)}`,
                status: "success",
            },
        });

        return jsonResponse({
            success: true,
            tunnelVerified: peerConnected,
            message: `VPN Test: Ping to ${tunnelIp} returned: \n${pingResult}\n\nIf Ping fails, VPN is dead. If Ping works, Port 80 is blocked!`,
        });
    } catch (err: any) {
        console.error("WireGuard activate error:", err);
        return errorResponse(err.message || "Failed to activate WireGuard", 500);
    }
}
