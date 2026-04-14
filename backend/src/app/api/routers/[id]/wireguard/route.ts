import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
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

        // Server-side keys (for the HQInvestment server)
        const serverPrivateKey = generateWireGuardKey();
        const serverPublicKey = derivePublicKeyPlaceholder(serverPrivateKey);

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
            });
        }

        const tunnelIp = router.wgTunnelIp || "10.200.0.1";
        const serverTunnelIp = "10.200.0.2";
        const listenPort = router.wgListenPort || 13231;
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || "vpn.hqinvestment.co.tz";
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

        const tunnelIp = router.wgTunnelIp || "10.200.0.1";
        const listenPort = router.wgListenPort || 13231;
        const serverEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || "vpn.hqinvestment.co.tz";
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        if (action === "push-config") {
            try {
                const service = await getMikroTikService(id, userPayload.tenantId);

                // Step 1: Create WireGuard interface
                try {
                    await service.apiRequestPublic("/interface/wireguard", "PUT", {
                        name: "wg-kenge",
                        "listen-port": String(listenPort),
                        "private-key": router.wgPrivateKey,
                    });
                } catch (e: any) {
                    if (!e.message?.includes("already")) throw e;
                }

                // Step 2: Assign IP address
                try {
                    await service.apiRequestPublic("/ip/address", "PUT", {
                        address: `${tunnelIp}/24`,
                        interface: "wg-kenge",
                        network: "10.200.0.0",
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
                        "allowed-address": "10.200.0.0/24",
                        "endpoint-address": serverEndpoint,
                        "endpoint-port": String(serverPort),
                        "persistent-keepalive": "25s",
                        comment: "HQInvestment ISP Server",
                    });
                } catch (e: any) {
                    if (!e.message?.includes("already")) console.warn("Peer note:", e.message);
                }

                // Step 4: Firewall
                try {
                    await service.apiRequestPublic("/ip/firewall/filter", "PUT", {
                        chain: "input", protocol: "udp", "dst-port": String(listenPort),
                        action: "accept", comment: "Allow WireGuard - HQInvestment",
                    });
                } catch (e: any) { console.warn("FW note:", e.message); }

                // Step 5: NAT
                try {
                    await service.apiRequestPublic("/ip/firewall/nat", "PUT", {
                        chain: "srcnat", "out-interface": "wg-kenge",
                        action: "masquerade", comment: "NAT WireGuard - HQInvestment",
                    });
                } catch (e: any) { console.warn("NAT note:", e.message); }

                // Step 6: Route
                try {
                    await service.apiRequestPublic("/ip/route", "PUT", {
                        "dst-address": "10.200.0.0/24", gateway: "wg-kenge",
                        comment: "WireGuard subnet route - HQInvestment",
                    });
                } catch (e: any) { console.warn("Route note:", e.message); }

                // Mark as configured and switch host to tunnel IP
                await updateRouterWgFields(id, {
                    wgEnabled: true,
                    wgConfiguredAt: new Date(),
                    host: tunnelIp,
                });

                await prisma.routerLog.create({
                    data: {
                        routerId: id,
                        action: "wireguard_pushed",
                        details: `WireGuard config auto-pushed to ${router.name}. Connection switched to tunnel IP ${tunnelIp}.`,
                        status: "success",
                    },
                });

                return jsonResponse({
                    success: true,
                    message: `WireGuard configured on ${router.name}. Tunnel IP: ${tunnelIp}.`,
                    tunnelVerified: false,
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
                    message: `Failed to auto-configure: ${err.message}. Use manual setup instead.`,
                }, 200);
            }
        }

        // Default: manual activate (user pasted the script)
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
