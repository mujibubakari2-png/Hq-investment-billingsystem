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

        if (!body.name || !body.host) {
            return errorResponse("Router name and host IP are required");
        }

        const existing = await prisma.router.findUnique({ where: { name: body.name } });
        if (existing) return errorResponse("Router name already exists");

        const router = await prisma.router.create({
            data: {
                name: body.name,
                host: body.host,
                username: body.username || "admin",
                password: body.password || "",
                port: body.port ? parseInt(body.port) : 8728,
                apiPort: body.apiPort ? parseInt(body.apiPort) : 8728,
                type: body.type || "MikroTik",
                vpnMode: body.vpnMode || "hybrid",
                description: body.description || "",
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

        return jsonResponse(router, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
