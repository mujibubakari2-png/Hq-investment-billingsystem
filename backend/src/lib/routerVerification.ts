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
    available?: boolean;
    www?: { enabled: boolean; port: number | null };
    wwwSsl?: { enabled: boolean; port: number | null };
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
        const webfigData = {
            www: { enabled: false, port: 80 as number | null },
            wwwSsl: { enabled: false, port: 443 as number | null }
        };
        for (const svc of services) {
            const enabled = svc.disabled !== "true" && svc.disabled !== true;
            const port = parseInt(svc.port || "0", 10);
            if (svc.name === "www") {
                webfigData.www = { enabled, port: isNaN(port) ? null : port };
            }
            if (svc.name === "www-ssl") {
                webfigData.wwwSsl = { enabled, port: isNaN(port) ? null : port };
            }
            if (svc.name === "winbox") {
                result.winbox = { reachable: true, authenticated: true, configured: true, enabled, port: isNaN(port) ? null : port };
            }
        }
        const webfigAvailable = webfigData.www.enabled || webfigData.wwwSsl.enabled;
        result.webfig = {
            reachable: true,
            authenticated: true,
            configured: true,
            enabled: webfigAvailable,
            available: webfigAvailable,
            www: webfigData.www,
            wwwSsl: webfigData.wwwSsl,
            port: webfigData.wwwSsl.enabled ? webfigData.wwwSsl.port : webfigData.www.port
        };

        // 2. WireGuard
        const wgIfaces = normalizeRosResponse(await service.apiRequestPublic("/interface/wireguard", "GET"));
        if (wgIfaces.length > 0) {
            const hqWg = wgIfaces.find((i: any) => i.name === "wg-hq") || wgIfaces[0];
            const enabled = hqWg.disabled !== "true" && hqWg.disabled !== true;
            result.wireguard = { reachable: true, authenticated: true, configured: true, enabled, port: parseInt(hqWg["listen-port"] || "0", 10) };
        }

        // 3. RADIUS
        const radiusClients = normalizeRosResponse(await service.apiRequestPublic("/radius", "GET"));
        if (radiusClients.length > 0) {
            const hqRad = radiusClients.find((r: any) => r.comment?.includes("HQ INVESTMENT") || (r.service && (r.service.includes("hotspot") || r.service.includes("ppp")))) || radiusClients[0];
            const enabled = hqRad.disabled !== "true" && hqRad.disabled !== true;
            result.radius = { reachable: true, authenticated: true, configured: true, enabled, port: null, details: hqRad.address };
        }

        // 4. Hotspot
        const hotspots = normalizeRosResponse(await service.apiRequestPublic("/ip/hotspot", "GET"));
        if (hotspots.length > 0) {
            const hqHs = hotspots.find((h: any) => h.name?.startsWith("hq-hotspot") || h.name?.startsWith("hotspot-")) || hotspots[0];
            const enabled = hqHs.disabled !== "true" && hqHs.disabled !== true;
            result.hotspot = { reachable: true, authenticated: true, configured: true, enabled, port: null };
        }

        // 5. PPPoE
        const pppoeServers = normalizeRosResponse(await service.apiRequestPublic("/interface/pppoe-server/server", "GET"));
        if (pppoeServers.length > 0) {
            const hqPpp = pppoeServers.find((p: any) => p["service-name"]?.startsWith("pppoe-svc-")) || pppoeServers[0];
            const enabled = hqPpp.disabled !== "true" && hqPpp.disabled !== true;
            result.pppoe = { reachable: true, authenticated: true, configured: true, enabled, port: null };
        }

        result.overallReady = result.api.enabled && result.webfig.configured && result.winbox.configured;
    } catch (err: any) {
        logger.error("[VERIFICATION] Error checking services", { error: err.message });
    }

    return result;
}
