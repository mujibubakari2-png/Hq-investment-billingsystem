import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import logger from "@/lib/logger";
import { resolveRouterManagementTarget } from "@/lib/routerAddressResolver";
import { createWebfigSession } from "@/lib/webfigProxyManager";
import { verifyRouterServices } from "@/lib/routerVerification";
import { getMikroTikService } from "@/lib/mikrotik";

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

        const target = resolveRouterManagementTarget(router as any, 'BACKEND_API');
        const proxyHost = process.env.SERVER_PUBLIC_IP || new URL(req.url).hostname || "localhost";
        
        let webfigUrl = `${target.protocol}://${target.host}:${target.port}`;
        let sessionId = null;
        let instructions = target.instructions;
        
        // Find which port WebFig is actually listening on
        let webfigPort = 80;
        try {
            const service = await getMikroTikService(router.id, router.tenantId);
            const verification = await verifyRouterServices(service);
            if (verification.webfig.port) {
                webfigPort = verification.webfig.port;
            }
        } catch (e) {
            logger.warn("[WEBFIG] Could not verify exact webfig port, defaulting to 80");
        }

        if (target.requiresVpn || target.reachableFrom === 'INTERNAL_BACKEND') {
            const proxy = await createWebfigSession(
                router.id,
                userPayload.userId,
                target.host, // The internal VPN IP
                webfigPort
            );
            sessionId = proxy.sessionId;
            webfigUrl = `http://${proxyHost}:${proxy.port}/webfig/`;
            instructions = `A secure WebFig gateway has been opened. Connect to ${webfigUrl}. This session expires in 1 hour.`;
            
            logger.info("[WEBFIG] Secure proxy session created", {
                routerId: id,
                proxyHost,
                proxyPort: proxy.port,
                targetHost: target.host,
                targetPort: webfigPort,
                userId: userPayload.userId
            });
        }

        return jsonResponse({
            routerId: router.id,
            routerName: router.name,
            host: proxyHost,
            // wgTunnelIp intentionally excluded — internal VPN IP must not reach browser
            browserReachable: true,
            hostIsVpnIp: false,
            webfigUrl,
            protocol: target.requiresVpn ? "https" : "http",
            sessionId,
            accessNote: instructions,
        });
    } catch (err: any) {
        logger.error("[WEBFIG] Error building access info", {
            error: err instanceof Error ? err.message : String(err),
        });
        return errorResponse("Failed to get WebFig access info", 500);
    }
}

