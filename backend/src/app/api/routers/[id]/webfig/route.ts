import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import logger from "@/lib/logger";

// GET /api/routers/[id]/webfig
//
// FORENSIC-FIX-003: The previous implementation returned a static HTML page that
// redirected to http://{router.host}. After a successful Auto-Push, router.host is
// switched to the WireGuard VPN tunnel IP (e.g. 10.0.0.200), which is only reachable
// from the VPS — NOT from the admin's browser. The iframe in RouterDetailModal.tsx
// loaded this page, which then tried to embed an unreachable IP, resulting in a blank
// iframe (timeout/blank) with no user-facing explanation.
//
// Fix: Return JSON with VPN-aware metadata so the frontend can show the correct URL
// and explain network requirements to the admin. Never proxy WebFig here (security).

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

        // Determine the correct address and protocol for WebFig.
        // The REST API port is separate from the WebFig port.
        // WebFig always runs on 80 (http) or 443 (https) on RouterOS.
        const useHttps = process.env.MIKROTIK_USE_HTTPS === "true";
        const protocol = useHttps ? "https" : "http";

        // Determine whether the stored host is a WireGuard VPN IP.
        // A VPN IP is any RFC-1918 private address — 10.x.x.x / 172.16-31.x.x / 192.168.x.x.
        // When router.wgEnabled is true and the host matches a private pattern, the admin
        // browser cannot reach it (only the VPS can route to the wg0 subnet).
        const hostIsVpnIp =
            router.wgEnabled === true &&
            /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(router.host);

        const webfigUrl = `${protocol}://${router.host}`;

        logger.info("[WEBFIG] Access request", {
            routerId: id,
            host: router.host,
            wgEnabled: router.wgEnabled,
            hostIsVpnIp,
        });

        // Return JSON — the frontend (RouterDetailModal) is responsible for rendering.
        return jsonResponse({
            routerId: id,
            routerName: router.name,
            host: router.host,
            wgEnabled: router.wgEnabled,
            wgTunnelIp: router.wgTunnelIp ?? null,
            // Whether the browser can reach this IP directly
            browserReachable: !hostIsVpnIp,
            webfigUrl,
            protocol,
            // Guidance to display to the admin
            accessNote: hostIsVpnIp
                ? `This router is managed over WireGuard VPN (tunnel IP: ${router.host}). ` +
                  `WebFig is accessible at ${webfigUrl} only from a machine connected to ` +
                  `the WireGuard VPN subnet. Your browser cannot reach this address directly. ` +
                  `Options: (1) Connect your admin PC to the WireGuard VPN, then open ${webfigUrl}. ` +
                  `(2) SSH into the VPS and use port-forwarding: ` +
                  `ssh -L 8080:${router.host}:80 user@vps-ip then open http://localhost:8080.`
                : `WebFig is accessible directly at ${webfigUrl}. Sign in with the router admin credentials.`,
        });
    } catch (err: any) {
        logger.error("[WEBFIG] Error building access info", {
            error: err instanceof Error ? err.message : String(err),
        });
        return errorResponse("Failed to get WebFig access info", 500);
    }
}

