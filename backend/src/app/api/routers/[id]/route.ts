import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { RouterUpdateSchema } from "@/lib/validators";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const router = await db.router.findUnique({
            where: { id },
            include: {
                packages: true,
                subscriptions: { include: { client: true, package: true } },
                equipments: true,
                _count: { select: { logs: true } },
            },
        });
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        // Mask sensitive fields for non-super-admins
        function mask(v: string | null | undefined) {
            if (!v) return null;
            if (v.length <= 4) return "****";
            return `****${v.slice(-4)}`;
        }

        const safeRouter = {
            ...router,
            password: userPayload.role === "SUPER_ADMIN" ? router.password : mask(router.password),
            wgPrivateKey: userPayload.role === "SUPER_ADMIN" ? router.wgPrivateKey : null,
            wgPresharedKey: userPayload.role === "SUPER_ADMIN" ? router.wgPresharedKey : null,
        };

        return jsonResponse(safeRouter);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;

        const existingRouter = await db.router.findUnique({ where: { id } });
        if (!existingRouter) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, existingRouter.tenantId)) {
            return errorResponse("Unauthorized to modify this router", 403);
        }

        const body = await req.json();
        const parsed = RouterUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data as any;

        const data: any = {};
        // Handle aliases
        const name = update.name || body.routerName || body.hostname || body.router_name;
        const host = update.host || body.host || body.hostIP || body.ipAddress || body.address || body.ip;
        const password = update.password || body.password || body.accessCode || body.secret || body.sharedSecret;
        const username = update.username || body.username || body.user;

        if (name) data.name = name;
        if (host) data.host = host;
        if (username !== undefined && username !== "") data.username = username;
        if (password !== undefined && password !== "") data.password = password;

        // Port handling - allow null to override defaults
        if (typeof update.port !== 'undefined' || typeof update.apiPort !== 'undefined' || body.port !== undefined || body.apiPort !== undefined) {
            const portVal = typeof update.port !== 'undefined' ? update.port : (body.port !== undefined ? body.port : update.apiPort !== undefined ? update.apiPort : body.apiPort);
            data.port = portVal === null ? null : parseInt(String(portVal));

            const apiPortVal = typeof update.apiPort !== 'undefined' ? update.apiPort : (body.apiPort !== undefined ? body.apiPort : portVal);
            data.apiPort = apiPortVal === null ? null : parseInt(String(apiPortVal));
        }

        if (update.vpnMode) data.vpnMode = update.vpnMode;
        if (typeof update.description !== 'undefined') data.description = update.description;
        if (update.status) data.status = update.status.toUpperCase();
        if (typeof update.accountingEnabled !== 'undefined') data.accountingEnabled = !!update.accountingEnabled;

        const router = await db.router.update({ where: { id }, data });

        // Synchronize with RADIUS NAS table to manage RADIUS via VPN
        const nasIp = router.wgTunnelIp || router.host;
        const existingNas = await db.radiusNas.findFirst({
            where: { tenantId: existingRouter.tenantId, nasName: nasIp }
        });

        if (existingNas) {
            // Do not store router management passwords in plaintext in the radiusNas table.
            // If a password is provided on the router record, store only a masked indicator or encrypt it.
            await db.radiusNas.update({
                where: { id: existingNas.id },
                data: { shortName: router.name }
            });
        } else {
            // Clean up old NAS entry if the IP changed
            if (existingRouter.wgTunnelIp !== router.wgTunnelIp || existingRouter.host !== router.host) {
                await db.radiusNas.deleteMany({
                    where: { tenantId: existingRouter.tenantId, nasName: existingRouter.wgTunnelIp || existingRouter.host }
                });
            }
            await db.radiusNas.create({
                data: {
                    nasName: nasIp,
                    shortName: router.name,
                    // Avoid persisting plaintext shared secrets. If callers need the secret, they
                    // must be SUPER_ADMIN and retrieve it from the router record (not from radiusNas).
                    secret: "REDACTED",
                    type: "other",
                    tenantId: existingRouter.tenantId,
                    description: "Auto-synced from Router (credentials redacted)"
                }
            });
        }

        // Log the update
        await db.routerLog.create({
            data: {
                routerId: id,
                tenantId: existingRouter.tenantId,
                action: "router_updated",
                details: `Router "${router.name}" settings updated`,
                status: "success",
            },
        });

        return jsonResponse({
            ...router,
            status: router.status === "ONLINE" ? "Online" : "Offline",
            router_id: router.id, // Alias
            ip: router.host, // Alias
        });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:delete");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;

        const existingRouter = await db.router.findUnique({ where: { id } });
        if (!existingRouter) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, existingRouter.tenantId)) {
            return errorResponse("Unauthorized to delete this router", 403);
        }

        await db.radiusNas.deleteMany({
            where: { tenantId: existingRouter.tenantId, nasName: existingRouter.wgTunnelIp || existingRouter.host }
        });
        await db.router.delete({ where: { id } });
        return jsonResponse({ message: "Router deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
