import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import logger from "@/lib/logger";

const WINBOX_SESSION_TTL_SECONDS = 15 * 60;

// FORENSIC-FIX-004: The previous implementation always returned `router.host` as the
// WinBox connect-to address. After a successful Auto-Push, router.host is switched to
// the WireGuard VPN tunnel IP (e.g. 10.0.0.200), which is only reachable from the VPS
// — NOT from the admin PC. The admin's WinBox application timed out because it was trying
// to connect to a private IP that is not routed on the admin's local network.
//
// Fix: Detect whether the router uses WireGuard (wgEnabled + private host IP).
// - Return the best reachable host along with a browserReachable flag.
// - When the host is a VPN IP, also surface the WAN IP (wanIp) if available so the
//   admin can use that for direct WinBox, or provide VPN access instructions.
// - Never expose private VPN IPs without making the network requirement explicit.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

        const body = await req.json().catch(() => ({}));
        const requestedPort = Number(body?.winboxPort ?? 8291);
        const port = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8291;

        // Determine whether the stored host is a private/VPN IP unreachable by the browser.
        const hostIsVpnIp =
            router.wgEnabled === true &&
            /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(router.host);

        // The WAN IP is stored separately if the system recorded it during initial setup.
        // wanIp is the publicly routable IP that the admin PC CAN reach for WinBox.
        const wanIp: string | null = (router as any).wanIp ?? null;

        // Which host should WinBox use?
        // If the router's host is a VPN IP and we have the original WAN IP, recommend that.
        // Otherwise surface router.host and let the admin know the requirement.
        const winboxHost = (hostIsVpnIp && wanIp) ? wanIp : router.host;
        const browserReachable = !hostIsVpnIp || !!(hostIsVpnIp && wanIp);

        let instructions: string;
        if (hostIsVpnIp && wanIp) {
            instructions =
                `WinBox → Connect To: ${wanIp}:${port}. ` +
                `Use the router admin credentials. ` +
                `(Router is managed over WireGuard VPN internally; using original WAN IP for WinBox.)`;
        } else if (hostIsVpnIp) {
            instructions =
                `This router is managed over WireGuard VPN (${router.host}). ` +
                `To use WinBox, your admin PC must be connected to the WireGuard VPN subnet. ` +
                `Then open WinBox → Connect To: ${router.host}:${port}. ` +
                `Alternatively, add the original WAN IP to the router record.`;
        } else {
            instructions =
                `Open WinBox → Connect To: ${router.host}:${port}. ` +
                `Use the router admin credentials.`;
        }

        logger.info("[WINBOX] Session created", {
            routerId: id,
            hostIsVpnIp,
            wanIpAvailable: !!wanIp,
            winboxHost,
            port,
            browserReachable,
        });

        return jsonResponse({
            host: winboxHost,
            vpnHost: hostIsVpnIp ? router.host : null,
            wanHost: wanIp,
            port,
            browserReachable,
            hostIsVpnIp,
            expiresInSeconds: WINBOX_SESSION_TTL_SECONDS,
            instructions,
        });
    } catch (err: any) {
        logger.error("[WINBOX] Session error", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to open WinBox session", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const { id } = await params;
        const queryPort = req.nextUrl.searchParams.get("port");
        const port = queryPort ? Number(queryPort) : undefined;

        return jsonResponse({ success: true, routerId: id, port });
    } catch {
        return errorResponse("Failed to close WinBox session", 500);
    }
}

