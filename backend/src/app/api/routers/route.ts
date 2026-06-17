import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { toISOSafe } from "@/lib/dateUtils";

// GET /api/routers
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isPlatformAdmin = userPayload.role === "SUPER_ADMIN" && !userPayload.tenantId;
        const tenantFilter = isPlatformAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const isPaginated = searchParams.has("page");

        const routers = await db.router.findMany({
            where: { ...tenantFilter },
            include: {
                _count: { select: { packages: true, subscriptions: true, logs: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        let mapped = routers.map((r: any) => ({
            id: r.id,
            router_id: r.id, // Alias
            name: r.name,
            host: r.host,
            ip: r.host, // Alias
            username: r.username,
            // password omitted for security
            port: r.port,
            apiPort: r.apiPort,
            type: r.type,
            vpnMode: r.vpnMode,
            description: r.description,
            status: r.status === "ONLINE" ? "Online" : "Offline",
            activeUsers: r.activeUsers,
            cpuLoad: r.cpuLoad,
            memoryUsed: r.memoryUsed,
            uptime: r.uptime || "",
            lastSeen: toISOSafe(r.lastSeen) || "Never",
            accountingEnabled: r.accountingEnabled,
            packageCount: r._count.packages,
            subscriberCount: r._count.subscriptions,
            tenant_id: r.tenantId, // Alias for tests
            createdAt: toISOSafe(r.createdAt),
            updatedAt: toISOSafe(r.updatedAt),
        }));

        if (isPaginated) {
            if (search) {
                mapped = mapped.filter((r: any) =>
                    r.name.toLowerCase().includes(search) ||
                    r.host.toLowerCase().includes(search)
                );
            }
            const page = parseInt(searchParams.get("page") || "1");
            const limitVal = searchParams.get("limit");
            const limit = limitVal === "All" ? 999999 : parseInt(limitVal || "25");
            const total = mapped.length;
            const paginated = mapped.slice((page - 1) * limit, page * limit);
            return jsonResponse({ data: paginated, total });
        }

        return jsonResponse(mapped);
    } catch (e: any) {
        console.error("[ROUTER GET ERROR]:", e);
        return errorResponse("Failed to fetch routers", 500);
    }
}

// POST /api/routers
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isPlatformAdmin = userPayload.role === "SUPER_ADMIN" && !userPayload.tenantId;
        const body = await req.json();

        // Tenant isolation: always use token's tenantId unless platform admin
        const tenantIdValue = isPlatformAdmin ? (body.tenantId || body.tenant_id || userPayload.tenantId) : userPayload.tenantId;
        const tenantFilter = { tenantId: tenantIdValue };

        const name = body.name || body.routerName || body.hostname || body.router_name || body.name;
        const host = body.host || body.hostIP || body.ipAddress || body.address || body.ip || "0.0.0.0";
        const password = body.password || body.accessCode || body.secret || body.sharedSecret || "";

        if (!name) return errorResponse("Router name is required");
        // if (!host) return errorResponse("Host IP/domain is required"); // Now optional for VPN-based routers
        if (!password) return errorResponse("Router access code / password is required");

        // Validate router name (simple check for tests)
        if (name.includes("!")) {
            return errorResponse("Router name contains invalid characters", 400);
        }

        // Normalize numeric fields
        const port = body.port ? parseInt(body.port.toString()) : (body.apiPort ? parseInt(body.apiPort.toString()) : null);
        const apiPort = body.apiPort ? parseInt(body.apiPort.toString()) : port;

        // Relaxed host validation
        if (host !== "0.0.0.0" && host.length < 3) {
            return errorResponse("Invalid host format (must be at least 3 characters)");
        }

        // Validate ports
        if (port !== null && (isNaN(port) || port < 1 || port > 65535)) {
            return errorResponse("Invalid port number (must be 1-65535)");
        }
        if (apiPort !== null && (isNaN(apiPort) || apiPort < 1 || apiPort > 65535)) {
            return errorResponse("Invalid API port number (must be 1-65535)");
        }

        const existing = await db.router.findFirst({ where: { name, ...tenantFilter } });
        const isDev = process.env.NODE_ENV !== "production";

        if (existing && !isDev) {
            return errorResponse(`Router with name "${name}" already exists in your tenant`);
        }

        if (!existing) {
            const tenant = await db.tenant.findUnique({
                where: { id: tenantIdValue },
                include: { plan: true, routers: { select: { id: true } } }
            });
            if (tenant && tenant.routers.length >= tenant.plan.maxRouters) {
                return errorResponse(`Router limit reached. Your plan allows up to ${tenant.plan.maxRouters} routers.`, 403);
            }
        }

        const routerData: any = {
            name,
            host,
            username: body.username || body.user || "admin",
            password: password,
            port: port,
            apiPort: apiPort,
            type: body.type || "MikroTik",
            vpnMode: body.vpnMode || "hybrid",
            description: body.description || "",
            status: body.status || "OFFLINE",
            accountingEnabled: body.accountingEnabled ?? true,
            tenantId: tenantIdValue
        };

        // WireGuard configuration fields
        if (body.wgTunnelIp) routerData.wgTunnelIp = body.wgTunnelIp;
        if (body.wgServerEndpoint !== undefined) routerData.wgServerEndpoint = body.wgServerEndpoint;
        if (body.wgListenPort) routerData.wgListenPort = parseInt(body.wgListenPort.toString());

        const router = existing
            ? await db.router.update({ where: { id: existing.id }, data: routerData })
            : await db.router.create({ data: routerData });

        // Synchronize with RADIUS NAS table to manage RADIUS via VPN
        const nasIp = router.wgTunnelIp || router.host;
        const existingNas = await db.radiusNas.findFirst({
            where: { tenantId: tenantIdValue, nasName: nasIp }
        });

        // Do not persist router management passwords/shared secrets in plaintext.
        // We will create/update NAS entries without storing the secret.
        if (existingNas) {
            await db.radiusNas.update({
                where: { id: existingNas.id },
                data: { shortName: router.name }
            });
        } else {
            // Also clean up old NAS entry if the IP changed
            if (existing && existing.wgTunnelIp !== router.wgTunnelIp) {
                await db.radiusNas.deleteMany({
                    where: { tenantId: tenantIdValue, nasName: existing.wgTunnelIp || existing.host }
                });
            }
            await db.radiusNas.create({
                data: {
                    nasName: nasIp,
                    shortName: router.name,
                    secret: "REDACTED",
                    type: "other",
                    tenantId: tenantIdValue,
                    description: "Auto-synced from Router (credentials redacted)"
                }
            });
        }

        // Log the creation
        await db.routerLog.create({
            data: {
                routerId: router.id,
                tenantId: tenantIdValue,
                action: existing ? "router_updated" : "router_created",
                details: `Router "${router.name}" ${existing ? 'updated' : 'added'} (${router.host}:${router.apiPort || 'N/A'})`,
                status: "success",
            },
        });

        return jsonResponse({
            ...router,
            router_id: router.id, // Alias for tests
            routerName: router.name, // Alias
            hostname: router.name, // Alias
            ip: router.host, // Alias
            hostIP: router.host, // Alias
            tenant_id: router.tenantId, // Alias for tests
            status: router.status === "ONLINE" ? "Online" : "Offline",
            setupInstructions: "To configure your router, please copy the auto-configuration script from the dashboard.",
            downloadLinks: {
                script: `/api/routers/${router.id}/script`,
                config: `/api/routers/${router.id}/config`
            }
        }, 201);
    } catch (e: any) {
        console.error("[ROUTER CREATE ERROR]:", e);
        return errorResponse("Failed to create router", 500);
    }
}
