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
        if (body.name) data.name = body.name;
        if (body.host) data.host = body.host;
        if (body.username !== undefined) data.username = body.username;
        if (body.password !== undefined) data.password = body.password;
        if (body.port) data.port = parseInt(body.port);
        if (body.apiPort) data.apiPort = parseInt(body.apiPort);
        if (body.vpnMode) data.vpnMode = body.vpnMode;
        if (body.description !== undefined) data.description = body.description;
        if (body.status) data.status = body.status.toUpperCase();

        const router = await prisma.router.update({ where: { id }, data });

        // Log the update
        await prisma.routerLog.create({
            data: {
                routerId: id,
                action: "router_updated",
                details: `Router "${router.name}" settings updated`,
                status: "success",
            },
        });

        return jsonResponse(router);
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
