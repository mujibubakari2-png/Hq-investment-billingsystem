import { MikroTikService } from "./mikrotik";
import logger from "./logger";

export interface VerificationResult {
    reachable: boolean;
    authenticated: boolean;
    configured: boolean;
    enabled: boolean;
    port: number | null;
    statusText?: string;
    details?: any;
}

export interface FullServiceVerification {
    api: VerificationResult;
    wireguard: VerificationResult;
    webfig: VerificationResult;
    winbox: VerificationResult;
    radius: VerificationResult;
    hotspot: VerificationResult;
    pppoe: VerificationResult;
    overallReady: boolean;
}

/**
 * Normalizes RouterOS responses handling object, array, null, undefined.
 * RouterOS 7.x sometimes returns objects instead of arrays.
 */
export function normalizeRosResponse(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (typeof response === 'object') return [response];
    return [];
}

export async function verifyApi(service: MikroTikService): Promise<VerificationResult> {
    try {
        const res = await service.apiRequestPublic("/system/identity", "GET");
        const identity = normalizeRosResponse(res);
        if (identity.length > 0 && identity[0]?.name) {
            return { reachable: true, authenticated: true, configured: true, enabled: true, port: (service as any).conn.port || null, statusText: identity[0].name };
        }
        return { reachable: true, authenticated: false, configured: false, enabled: false, port: (service as any).conn.port || null, statusText: "Authentication Failed or Invalid Response" };
    } catch (err: any) {
        return { reachable: false, authenticated: false, configured: false, enabled: false, port: (service as any).conn.port || null, statusText: err.message || "Unreachable" };
    }
}

export async function verifyRouterServices(service: MikroTikService): Promise<FullServiceVerification> {
    const result: FullServiceVerification = {
        api: await verifyApi(service),
        wireguard: { reachable: false, authenticated: false, configured: false, enabled: false, port: null },
        webfig: { reachable: false, authenticated: false, configured: false, enabled: false, port: null },
        winbox: { reachable: false, authenticated: false, configured: false, enabled: false, port: null },
        radius: { reachable: false, authenticated: false, configured: false, enabled: false, port: null },
        hotspot: { reachable: false, authenticated: false, configured: false, enabled: false, port: null },
        pppoe: { reachable: false, authenticated: false, configured: false, enabled: false, port: null },
        overallReady: false
    };

    if (!result.api.authenticated) {
        return result; // Cannot verify further
    }

    try {
        // 1. IP Services (WebFig, WinBox, API)
        const services = normalizeRosResponse(await service.apiRequestPublic("/ip/service", "GET"));
        for (const svc of services) {
            const enabled = svc.disabled !== "true" && svc.disabled !== true;
            const port = parseInt(svc.port || "0", 10);
            if (svc.name === "www" || svc.name === "www-ssl") {
                result.webfig = { reachable: true, authenticated: true, configured: true, enabled, port };
            }
            if (svc.name === "winbox") {
                result.winbox = { reachable: true, authenticated: true, configured: true, enabled, port };
            }
        }

        // 2. WireGuard
        const wgIfaces = normalizeRosResponse(await service.apiRequestPublic("/interface/wireguard", "GET"));
        if (wgIfaces.length > 0) {
            const enabled = wgIfaces[0].disabled !== "true" && wgIfaces[0].disabled !== true;
            result.wireguard = { reachable: true, authenticated: true, configured: true, enabled, port: parseInt(wgIfaces[0]["listen-port"] || "0", 10) };
        }

        // 3. RADIUS
        const radiusClients = normalizeRosResponse(await service.apiRequestPublic("/radius", "GET"));
        if (radiusClients.length > 0) {
            const enabled = radiusClients[0].disabled !== "true" && radiusClients[0].disabled !== true;
            result.radius = { reachable: true, authenticated: true, configured: true, enabled, port: null, details: radiusClients[0].address };
        }

        // 4. Hotspot
        const hotspots = normalizeRosResponse(await service.apiRequestPublic("/ip/hotspot", "GET"));
        if (hotspots.length > 0) {
            const enabled = hotspots[0].disabled !== "true" && hotspots[0].disabled !== true;
            result.hotspot = { reachable: true, authenticated: true, configured: true, enabled, port: null };
        }

        // 5. PPPoE
        const pppoeServers = normalizeRosResponse(await service.apiRequestPublic("/interface/pppoe-server/server", "GET"));
        if (pppoeServers.length > 0) {
            const enabled = pppoeServers[0].disabled !== "true" && pppoeServers[0].disabled !== true;
            result.pppoe = { reachable: true, authenticated: true, configured: true, enabled, port: null };
        }

        result.overallReady = result.api.enabled && result.webfig.configured && result.winbox.configured;
    } catch (err: any) {
        logger.error("[VERIFICATION] Error checking services", { error: err.message });
    }

    return result;
}
