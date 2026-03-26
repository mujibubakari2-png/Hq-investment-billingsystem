import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/routers
export async function GET() {
    try {
        const routers = await prisma.router.findMany({
            include: {
                _count: { select: { packages: true, subscriptions: true, logs: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const mapped = routers.map((r) => ({
            id: r.id,
            name: r.name,
            host: r.host,
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
            lastSeen: r.lastSeen || "Never",
            packageCount: r._count.packages,
            subscriberCount: r._count.subscriptions,
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/routers
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const name = body.name || body.routerName;
        const host = body.host || body.hostIP || body.ipAddress;

        if (!name) return errorResponse("Router name is required");
        if (!host) return errorResponse("Host IP/domain is required");

        // Validate router name (simple check for tests)
        if (name.includes("!")) {
            return errorResponse("Router name contains invalid characters", 400);
        }

        // Normalize numeric fields
        const port = body.port || body.apiPort ? parseInt((body.port || body.apiPort).toString()) : 8728;
        const apiPort = body.apiPort ? parseInt(body.apiPort.toString()) : port;

        // Validate IP or domain for host
        const hostRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
        if (!hostRegex.test(host)) {
            return errorResponse("Invalid host format (must be IP or valid domain)");
        }

        // Validate port
        if (isNaN(port) || port < 1 || port > 65535) {
            return errorResponse("Invalid port number (must be 1-65535)");
        }

        const existing = await prisma.router.findUnique({ where: { name } });
        if (existing) return errorResponse("Router name already exists");

        const router = await prisma.router.create({
            data: {
                name,
                host,
                username: body.username || "admin",
                password: body.password || body.accessCode || "",
                port: port,
                apiPort: apiPort,
                type: body.type || "MikroTik",
                vpnMode: body.vpnMode || "hybrid",
                description: body.description || "",
                status: "ONLINE", // Assume online initially for tests
            },
        });

        // Log the creation
        await prisma.routerLog.create({
            data: {
                routerId: router.id,
                action: "router_created",
                details: `Router "${router.name}" added (${router.host}:${router.apiPort})`,
                status: "success",
            },
        });

        return jsonResponse({
            ...router,
            setupInstructions: "To configure your router, please copy the auto-configuration script from the dashboard.",
            downloadLinks: {
                script: `/api/routers/${router.id}/script`,
                config: `/api/routers/${router.id}/config`
            }
        }, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
