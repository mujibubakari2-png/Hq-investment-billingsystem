import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { getMikroTikService } from "@/lib/mikrotik";
import { wireguardManager } from "@/lib/wireguard";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const router = await db.router.findUnique({ where: { id } });
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        const service = await getMikroTikService(id, userPayload.tenantId);
        
        let apiReachable = false;
        let hotspotConfigured = false;
        let pppoeConfigured = false;
        let radiusConfigured = false;
        let vpnActive = false;
        let lastHandshakeSeconds: number | null = null;
        let details: Record<string, any> = {};

        // 1. API Reachability
        // FORENSIC-FIX-001: RouterOS 7.x REST API returns /system/identity as a single
        // JSON object {"name":"…"}, NOT an array. The old check `Array.isArray(identity)`
        // always evaluated to false on RouterOS 7, making every router appear offline even
        // when perfectly reachable. Now handles both object (ROS 7.x) and array (ROS 6.x).
        try {
            const identity = await service.apiRequestPublic("/system/identity");
            const identObj = Array.isArray(identity) ? identity[0] : identity;
            apiReachable = !!(identObj && typeof identObj === "object" && "name" in identObj);
            if (apiReachable) details.identity = (identObj as any).name;
            logger.info("[VERIFY] API reachability check", {
                routerId: id,
                stage: "API_REACHABILITY",
                result: apiReachable ? "SUCCESS" : "FAILED",
                identity: apiReachable ? (identObj as any).name : undefined,
            });
        } catch (err: any) {
            apiReachable = false;
            logger.warn("[VERIFY] API unreachable", {
                routerId: id,
                stage: "API_REACHABILITY",
                result: "FAILED",
                errorCode: "ROUTER_UNREACHABLE",
                errorMessage: err?.message,
            });
        }

        const normalize = (res: any) => Array.isArray(res) ? res : (res ? [res] : []);

        // 2. Hotspot profile presence
        if (apiReachable && (router.serviceType === "hotspot" || router.serviceType === "both" || !router.serviceType)) {
            try {
                const profilesRaw = await service.apiRequestPublic("/ip/hotspot/profile");
                const profiles = normalize(profilesRaw);
                if (profiles.length > 0) {
                    // FORENSIC-FIX-002: use-radius can be "yes" (string, ROS 7.x) or true
                    // (boolean, some firmware versions). The old strict "=== 'yes'" check
                    // failed when RouterOS returned a boolean true, making hotspot always
                    // appear unconfigured after a successful Auto-Push.
                    const hqProf = profiles.find((p: any) =>
                        (p["use-radius"] === "yes" || p["use-radius"] === true) &&
                        p.name !== "default"
                    );
                    if (hqProf) {
                        hotspotConfigured = true;
                        details.hotspotProfile = hqProf.name;
                    }
                }
                logger.info("[VERIFY] Hotspot profile check", {
                    routerId: id,
                    stage: "HOTSPOT_PROFILE",
                    result: hotspotConfigured ? "CONFIGURED" : "NOT_FOUND",
                });
            } catch (err: any) {
                logger.warn("[VERIFY] Hotspot check failed", { routerId: id, errorMessage: err?.message });
            }
        }

        // 3. PPPoE server presence
        if (apiReachable && (router.serviceType === "pppoe" || router.serviceType === "both" || !router.serviceType)) {
            try {
                const serversRaw = await service.apiRequestPublic("/interface/pppoe-server/server");
                const servers = normalize(serversRaw);
                if (servers.length > 0) {
                    // disabled can be "false" (string) or false (boolean)
                    const pppoeSrv = servers.find((s: any) =>
                        s.disabled === "false" || s.disabled === false
                    );
                    if (pppoeSrv) {
                        pppoeConfigured = true;
                        details.pppoeServer = pppoeSrv["service-name"];
                    }
                }
                logger.info("[VERIFY] PPPoE server check", {
                    routerId: id,
                    stage: "PPPOE_SERVER",
                    result: pppoeConfigured ? "CONFIGURED" : "NOT_FOUND",
                });
            } catch (err: any) {
                logger.warn("[VERIFY] PPPoE check failed", { routerId: id, errorMessage: err?.message });
            }
        }

        // 4. RADIUS server presence — was completely missing from previous verify
        if (apiReachable) {
            try {
                const radServers = await service.apiRequestPublic("/radius");
                const servers = Array.isArray(radServers) ? radServers : (radServers ? [radServers] : []);
                const hqRad = servers.find((r: any) =>
                    r.comment?.includes("HQ INVESTMENT") ||
                    (r.service && (r.service.includes("hotspot") || r.service.includes("ppp")))
                );
                if (hqRad) {
                    radiusConfigured = true;
                    details.radiusServer = hqRad.address;
                }
                logger.info("[VERIFY] RADIUS server check", {
                    routerId: id,
                    stage: "RADIUS_SERVER",
                    result: radiusConfigured ? "CONFIGURED" : "NOT_FOUND",
                });
            } catch (err: any) {
                logger.warn("[VERIFY] RADIUS check failed", { routerId: id, errorMessage: err?.message });
            }
        }

        // 5. WireGuard Handshake (server-side verification)
        if (router.wgEnabled && router.wgPublicKey) {
            try {
                const peers = await wireguardManager.listPeers();
                const peer = peers.find(p => p.publicKey === router.wgPublicKey);
                if (peer && peer.latestHandshake && peer.latestHandshake !== "0") {
                    const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(peer.latestHandshake);
                    lastHandshakeSeconds = ageSeconds;
                    vpnActive = ageSeconds < 180; // active if handshake < 3 minutes ago
                }
                logger.info("[VERIFY] WireGuard handshake check", {
                    routerId: id,
                    stage: "VPN_HANDSHAKE",
                    result: vpnActive ? "ACTIVE" : "STALE_OR_NONE",
                    lastHandshakeSeconds,
                });
            } catch (err: any) {
                logger.warn("[VERIFY] WireGuard handshake check failed", { routerId: id, errorMessage: err?.message });
            }
        }

        // Derive high-level status message
        let statusMessage = "Verification successful.";
        if (!apiReachable) {
            statusMessage = "Router API is unreachable. Check power, network, or VPN tunnel.";
        } else if (router.wgEnabled && !vpnActive) {
            statusMessage = "API reachable, but VPN tunnel is DOWN or handshake is stale.";
        } else if (!hotspotConfigured && !pppoeConfigured) {
            statusMessage = "API reachable, but no Hotspot or PPPoE services found on the router. Run Auto-Push first.";
        } else if (!radiusConfigured) {
            statusMessage = "Services configured, but RADIUS server not found. Run Auto-Push to register RADIUS.";
        }

        logger.info("[VERIFY] Complete", {
            routerId: id,
            apiReachable,
            vpnActive,
            hotspotConfigured,
            pppoeConfigured,
            radiusConfigured,
            statusMessage,
        });

        return jsonResponse({
            apiReachable,
            vpnActive,
            hotspotConfigured,
            pppoeConfigured,
            radiusConfigured,
            lastHandshakeSeconds,
            statusMessage,
            details,
        });

    } catch (err: any) {
        logger.error("Router verification error:", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to verify router state", 500);
    }
}
