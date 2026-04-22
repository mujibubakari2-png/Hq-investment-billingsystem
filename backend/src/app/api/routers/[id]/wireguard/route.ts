import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { wireguardManager } from "@/lib/wireguard";
import crypto from "crypto";

// ── Key helpers ─────────────────────────────────────────────────────────────

function generateWireGuardKey(): string {
    return crypto.randomBytes(32).toString("base64");
}

function derivePublicKeyPlaceholder(privateKey: string): string {
    const hash = crypto.createHash("sha256").update(privateKey).digest();
    return hash.toString("base64");
}

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
        const serverPrivateKey = process.env.WG_SERVER_PRIVATE_KEY || generateWireGuardKey();
        const serverPublicKey = process.env.WG_SERVER_PUBLIC_KEY || derivePublicKeyPlaceholder(serverPrivateKey);

        // Logic to assign a unique Tunnel IP if not set or if it's the old 10.200.x.x
        if (!tunnelIp || tunnelIp === "10.200.0.1" || tunnelIp.startsWith("10.200.")) {
            const allWgRouters = await prisma.router.findMany({
                where: { id: { not: id }, wgTunnelIp: { not: null } },
                select: { wgTunnelIp: true }
            });
            const usedIps = allWgRouters.map(r => r.wgTunnelIp);
            
            // Find first free IP from 10.0.0.200 to 10.0.0.250
            let nextIp = 200;
            while (usedIps.includes(`10.0.0.${nextIp}`) && nextIp < 250) {
                nextIp++;
            }
            tunnelIp = `10.0.0.${nextIp}`;
            await updateRouterWgFields(id, { wgTunnelIp: tunnelIp });
        }

        if (!wgPrivateKey) {
            wgPrivateKey = generateWireGuardKey();
            wgPublicKey = derivePublicKeyPlaceholder(wgPrivateKey);
            wgPeerPublicKey = serverPublicKey;
            wgPresharedKey = generateWireGuardKey();

            await updateRouterWgFields(id, {
                wgPrivateKey,
                wgPublicKey,
                wgPeerPublicKey,
                wgPresharedKey,
                wgTunnelIp: tunnelIp, // Save assigned IP
            });
        } else if (process.env.WG_SERVER_PUBLIC_KEY && wgPeerPublicKey !== process.env.WG_SERVER_PUBLIC_KEY) {
            // Update the peer public key if the environment variable changes
            wgPeerPublicKey = process.env.WG_SERVER_PUBLIC_KEY;
            await updateRouterWgFields(id, { wgPeerPublicKey });
        }

        const serverTunnelIp = "10.0.0.1"; // Droplet server is always 10.0.0.1
        const listenPort = router.wgListenPort || 13231;
        
        // Use request host as fallback if no endpoint is configured
        const requestHost = req.headers.get("host")?.split(":")[0];
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || requestHost || "vpn.billing-system.local";
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

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

        // Ensure keys exist
        if (!router.wgPrivateKey || !router.wgPublicKey) {
            return errorResponse("WireGuard keys not generated. Open config first.", 400);
        }

        let tunnelIp = router.wgTunnelIp;
        if (!tunnelIp || tunnelIp === "10.200.0.1" || tunnelIp.startsWith("10.200.")) {
            tunnelIp = "10.0.0.200"; // Fallback if somehow not generated
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
                        network: "10.0.0.0",
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
                        "preshared-key": router.wgPresharedKey,
                        "allowed-address": "10.0.0.0/24",
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
                        action: "accept", comment: "Allow WireGuard - Kenge", "place-before": "0"
                    },
                    {
                        chain: "forward", "in-interface": "wg-kenge",
                        action: "accept", comment: "Allow WG traffic", "place-before": "0"
                    },
                    {
                        chain: "forward", "out-interface": "wg-kenge",
                        action: "accept", comment: "Allow WG return traffic", "place-before": "0"
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
                        "dst-address": "10.0.0.0/24", gateway: "wg-kenge",
                        comment: "WireGuard subnet route - Kenge",
                    });
                } catch (e: any) { console.warn("Route note:", e.message); }

                // Add peer to the Server's WireGuard interface
                try {
                    await wireguardManager.addPeer(router.wgPublicKey, tunnelIp);
                } catch (e: any) {
                    console.error("Failed to add peer to wg0:", e.message);
                }

                // Verification Step: Try to reach the router via its NEW tunnel IP before switching the host in DB
                let tunnelVerified = false;
                // Wait a few seconds for the tunnel to establish
                await new Promise(resolve => setTimeout(resolve, 3000));

                try {
                    // Create a temporary service instance with the tunnel IP
                    const tunnelService = await getMikroTikService(id, userPayload.tenantId);
                    // Override the host manually for verification
                    (tunnelService as any).conn.host = tunnelIp;
                    (tunnelService as any).baseUrl = `http://${tunnelIp}:80`;
                    
                    const test = await tunnelService.testConnection();
                    if (test.success) {
                        tunnelVerified = true;
                    }
                } catch (e: any) {
                    console.warn("Tunnel verification failed:", e.message);
                }

                // Update router state
                const updateData: Record<string, any> = {
                    wgEnabled: true,
                    wgConfiguredAt: new Date(),
                };

                // Only switch the host if the tunnel is verified working
                // This prevents "losing" the router if the tunnel fails to come up
                if (tunnelVerified) {
                    updateData.host = tunnelIp;
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
                        ? `WireGuard configured and verified on ${router.name}. Tunnel IP: ${tunnelIp}.`
                        : `WireGuard configured on ${router.name}, but tunnel is not yet reachable. Keeping original host IP for now.`,
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

        // Default: manual activate (user pasted the script)
        try {
            await wireguardManager.addPeer(router.wgPublicKey, tunnelIp);
        } catch (err: any) {
            console.error("Failed to add peer:", err);
            return errorResponse(`Failed to add peer to server: ${err.message}`, 500);
        }

        await updateRouterWgFields(id, {
            wgEnabled: true,
            wgConfiguredAt: new Date(),
            host: tunnelIp,
        });

        await prisma.routerLog.create({
            data: {
                routerId: id,
                action: "wireguard_activated",
                details: `WireGuard activated for ${router.name}. Host switched to tunnel IP ${tunnelIp}.`,
                status: "success",
            },
        });

        return jsonResponse({
            success: true,
            message: `WireGuard activated. Router host updated to tunnel IP ${tunnelIp}.`,
            tunnelVerified: false,
        });
    } catch (err: any) {
        console.error("WireGuard activate error:", err);
        return errorResponse(err.message || "Failed to activate WireGuard", 500);
    }
}
