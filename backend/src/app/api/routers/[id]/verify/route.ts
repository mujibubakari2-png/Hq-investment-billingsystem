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
        let vpnActive = false;
        let lastHandshakeSeconds: number | null = null;
        let details: Record<string, any> = {};

        // 1. API Reachability
        try {
            const identity = await service.apiRequestPublic("/system/identity");
            apiReachable = Array.isArray(identity) && identity.length > 0;
            if (apiReachable) details.identity = identity[0].name;
        } catch {
            apiReachable = false;
        }

        // 2. Hotspot profile presence
        if (apiReachable && (router.serviceType === "hotspot" || router.serviceType === "both" || !router.serviceType)) {
            try {
                const profiles = await service.apiRequestPublic("/ip/hotspot/profile");
                if (Array.isArray(profiles)) {
                    const hqProf = profiles.find((p: any) => p["use-radius"] === "yes" && p.name !== "default");
                    if (hqProf) {
                        hotspotConfigured = true;
                        details.hotspotProfile = hqProf.name;
                    }
                }
            } catch {}
        }

        // 3. PPPoE server presence
        if (apiReachable && (router.serviceType === "pppoe" || router.serviceType === "both" || !router.serviceType)) {
            try {
                const servers = await service.apiRequestPublic("/interface/pppoe-server/server");
                if (Array.isArray(servers)) {
                    const pppoeSrv = servers.find((s: any) => !s.disabled);
                    if (pppoeSrv) {
                        pppoeConfigured = true;
                        details.pppoeServer = pppoeSrv["service-name"];
                    }
                }
            } catch {}
        }

        // 4. WireGuard Handshake (server-side verification)
        if (router.wgEnabled && router.wgPublicKey) {
            try {
                const peers = await wireguardManager.listPeers();
                const peer = peers.find(p => p.publicKey === router.wgPublicKey);
                if (peer && peer.latestHandshake && peer.latestHandshake !== '0') {
                    const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(peer.latestHandshake);
                    lastHandshakeSeconds = ageSeconds;
                    vpnActive = ageSeconds < 180; // active if handshake < 3 minutes ago
                }
            } catch {}
        }

        // Derive high-level status message
        let statusMessage = "Verification successful.";
        if (!apiReachable) {
            statusMessage = "Router API is unreachable. Check power, network, or VPN tunnel.";
        } else if (router.wgEnabled && !vpnActive) {
            statusMessage = "API reachable, but VPN tunnel is DOWN or handshake is stale.";
        } else if (!hotspotConfigured && !pppoeConfigured) {
            statusMessage = "API reachable, but no Hotspot or PPPoE services found on the router.";
        }

        return jsonResponse({
            apiReachable,
            vpnActive,
            hotspotConfigured,
            pppoeConfigured,
            lastHandshakeSeconds,
            statusMessage,
            details,
        });

    } catch (err: any) {
        logger.error("Router verification error:", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to verify router state", 500);
    }
}
