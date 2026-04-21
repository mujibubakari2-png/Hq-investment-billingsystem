import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const router = await prisma.router.findUnique({
            where: { id },
            include: {
                packages: true,
                subscriptions: { include: { client: true, package: true } },
                equipments: true,
                _count: { select: { logs: true } },
            },
        });
        if (!router) return errorResponse("Router not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        return jsonResponse(router);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;

        const existingRouter = await prisma.router.findUnique({ where: { id } });
        if (!existingRouter) return errorResponse("Router not found", 404);
        
        if (userPayload.role !== "SUPER_ADMIN" && existingRouter.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to modify this router", 403);
        }

        const body = await req.json();

        const data: any = {};
        // Handle aliases
        const name = body.name || body.routerName || body.hostname || body.router_name;
        const host = body.host || body.hostIP || body.ipAddress || body.address || body.ip;
        const password = body.password || body.accessCode || body.secret || body.sharedSecret;
        const username = body.username || body.user;

        if (name) data.name = name;
        if (host) data.host = host;
        if (username !== undefined) data.username = username;
        if (password !== undefined) data.password = password;
        
        // Port handling - allow null to override defaults
        if (body.port !== undefined || body.apiPort !== undefined) {
            const portVal = body.port !== undefined ? body.port : body.apiPort;
            data.port = portVal === null ? null : parseInt(portVal.toString());
            
            const apiPortVal = body.apiPort !== undefined ? body.apiPort : portVal;
            data.apiPort = apiPortVal === null ? null : parseInt(apiPortVal.toString());
        }

        if (body.vpnMode) data.vpnMode = body.vpnMode;
        if (body.description !== undefined) data.description = body.description;
        if (body.status) data.status = body.status.toUpperCase();
        if (body.accountingEnabled !== undefined) data.accountingEnabled = !!body.accountingEnabled;

        const router = await prisma.router.update({ where: { id }, data });

        // Log the update
        await prisma.routerLog.create({
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        
        const existingRouter = await prisma.router.findUnique({ where: { id } });
        if (!existingRouter) return errorResponse("Router not found", 404);
        
        if (userPayload.role !== "SUPER_ADMIN" && existingRouter.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to delete this router", 403);
        }

        await prisma.router.delete({ where: { id } });
        return jsonResponse({ message: "Router deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
