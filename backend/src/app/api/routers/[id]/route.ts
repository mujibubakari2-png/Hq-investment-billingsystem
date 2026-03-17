import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
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
        return jsonResponse(router);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.router.delete({ where: { id } });
        return jsonResponse({ message: "Router deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
