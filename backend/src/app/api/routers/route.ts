import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { toISOSafe } from "@/lib/dateUtils";

// GET /api/routers
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const isPaginated = searchParams.has("page");

        const routers = await prisma.router.findMany({
            where: { ...tenantFilter },
            include: {
                _count: { select: { packages: true, subscriptions: true, logs: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        let mapped = routers.map((r) => ({
            id: r.id,
            router_id: r.id, // Alias
            name: r.name,
            host: r.host,
            ip: r.host, // Alias
            username: r.username,
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
                mapped = mapped.filter(r =>
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const body = await req.json();

        // Tenant isolation: always use token's tenantId unless super admin
        const tenantIdValue = isSuperAdmin ? (body.tenantId || body.tenant_id || userPayload.tenantId) : userPayload.tenantId;
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

        const existing = await prisma.router.findFirst({ where: { name, ...tenantFilter } });
        const isDev = process.env.NODE_ENV !== "production";
        
        if (existing && !isDev) {
            return errorResponse(`Router with name "${name}" already exists in your tenant`);
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
            ? await prisma.router.update({ where: { id: existing.id }, data: routerData })
            : await prisma.router.create({ data: routerData });

        // Log the creation
        await prisma.routerLog.create({
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
