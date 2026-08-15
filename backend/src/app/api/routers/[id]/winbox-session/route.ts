import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import logger from "@/lib/logger";
import { resolveRouterManagementTarget } from "@/lib/routerAddressResolver";
import { createWinboxSession, destroySession, getSessionByOwner } from "@/lib/winboxProxyManager";

const WINBOX_IDLE_TTL_SECONDS = 15 * 60;

/**
 * Extract the real client IP from the request.
 *
 * Trust: nginx sets X-Real-IP = $remote_addr (socket IP), which cannot be
 * forged by the browser. X-Forwarded-For is NOT used here because it can be
 * multi-valued and clients can inject values at the front of the chain.
 */
function extractClientIp(req: NextRequest): string {
    // X-Real-IP is set by nginx to the actual TCP socket address
    const realIp = req.headers.get('x-real-ip');
    if (realIp && realIp.trim()) return realIp.trim();

    // Fallback (e.g., local dev without nginx): use first X-Forwarded-For value
    // This is acceptable in dev because there is no public internet exposure.
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();

    // Last resort: parse from URL (only meaningful if Next.js exposes it)
    return '0.0.0.0';
}

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

        // Capture the admin's public IP server-side — never from the request body
        const adminSourceIp = extractClientIp(req);

        // Resolve target purely from backend context — browser never controls this
        const target = resolveRouterManagementTarget(router as any, 'BACKEND_API');

        // Public host that the Admin PC will connect to
        const proxyHost = process.env.SERVER_PUBLIC_IP || new URL(req.url).hostname || "localhost";

        let proxyPort: number | null = null;
        let sessionId: string | null = null;
        let idleExpiresAt: number | null = null;
        let maxLifetimeAt: number | null = null;
        let instructions = target.instructions;

        if (target.requiresVpn || target.reachableFrom === 'INTERNAL_BACKEND') {
            const proxy = await createWinboxSession(
                router.id,
                userPayload.userId,
                router.tenantId,   // tenantId for cleanup audit
                target.host,       // internal VPN IP — server-resolved
                8291,              // RouterOS WinBox port — server-controlled
                adminSourceIp      // captured from nginx X-Real-IP
            );
            proxyPort = proxy.port;
            sessionId = proxy.sessionId;
            idleExpiresAt = proxy.idleExpiresAt;
            maxLifetimeAt = proxy.maxLifetimeAt;
            instructions = `A temporary WinBox proxy has been created. Connect WinBox to ${proxyHost}:${proxyPort}. Session expires after 15 minutes idle (max 1 hour).`;

            logger.info("[WINBOX] Proxy session created", {
                routerId: id,
                proxyHost,
                proxyPort,
                userId: userPayload.userId,
                allowedSourceIp: adminSourceIp,
                // targetHost NOT logged — avoids leaking internal VPN IP
            });
        }

        return jsonResponse({
            host: proxyHost,
            port: proxyPort,
            sessionId,
            browserReachable: true,
            hostIsVpnIp: false,
            expiresInSeconds: WINBOX_IDLE_TTL_SECONDS,
            idleExpiresAt,
            maxLifetimeAt,
            instructions,
        });
    } catch (err: any) {
        logger.error("[WINBOX] Session creation error", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to open WinBox session", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // 1. Authenticate
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        // 2. Resolve router
        const { id } = await params;
        const db = getTenantClient(userPayload);
        const router = await db.router.findUnique({ where: { id } });
        if (!router) return errorResponse("Router not found", 404);

        // 3. Tenant isolation
        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        // 4. Require sessionId — never rely on port alone
        const sessionId = req.nextUrl.searchParams.get("sessionId") || null;
        if (!sessionId) {
            return errorResponse("sessionId is required", 400);
        }

        // 5. Verify ownership: the session must belong to this user AND this router
        const session = getSessionByOwner(sessionId, userPayload.userId, id);
        if (!session) {
            return errorResponse("Session not found or not owned by you", 404);
        }

        // 6. Destroy: closes TCP server, force-kills all active sockets, clears maps
        const destroyed = destroySession(sessionId);
        if (!destroyed) {
            return errorResponse("Session already closed", 404);
        }

        logger.info("[WINBOX] Session destroyed by user", {
            sessionId,
            routerId: id,
            userId: userPayload.userId,
        });

        return jsonResponse({ success: true, sessionId, routerId: id });
    } catch (err: any) {
        logger.error("[WINBOX] Session deletion error", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to close WinBox session", 500);
    }
}


