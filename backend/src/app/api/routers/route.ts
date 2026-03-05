import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/routers
export async function GET() {
    try {
        const routers = await prisma.router.findMany({
            include: {
                _count: { select: { packages: true, subscriptions: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const mapped = routers.map((r: {
            id: string;
            name: string;
            host: string;
            username: string | null;
            port: number | null;
            type: string;
            status: string;
            activeUsers: number;
            cpuLoad: number;
            memoryUsed: number;
            uptime: string | null;
            lastSeen: string | null;
            _count: { packages: number; subscriptions: number };
        }) => ({
            id: r.id,
            name: r.name,
            host: r.host,
            username: r.username,
            port: r.port,
            type: r.type,
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

        const existing = await prisma.router.findUnique({ where: { name: body.name } });
        if (existing) return errorResponse("Router name already exists");

        const router = await prisma.router.create({
            data: {
                name: body.name,
                host: body.host,
                username: body.username,
                password: body.password,
                port: body.port ? parseInt(body.port) : 8728,
                type: body.type || "MikroTik",
            },
        });

        return jsonResponse(router, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
