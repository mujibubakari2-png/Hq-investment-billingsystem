import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import logger from "@/lib/logger";
import { resolveRouterManagementTarget } from "@/lib/routerAddressResolver";

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

        const target = resolveRouterManagementTarget(router as any, 'WEBFIG_CLIENT');

        return jsonResponse({
            routerId: router.id,
            routerName: router.name,
            host: target.host,
            wgTunnelIp: router.wgTunnelIp,
            browserReachable: !target.requiresVpn,
            hostIsVpnIp: target.requiresVpn,
            webfigUrl: `${target.protocol}://${target.host}:${target.port}`,
            protocol: target.protocol,
            accessNote: target.instructions,
        });
    } catch (err: any) {
        logger.error("[WEBFIG] Error building access info", {
            error: err instanceof Error ? err.message : String(err),
        });
        return errorResponse("Failed to get WebFig access info", 500);
    }
}

