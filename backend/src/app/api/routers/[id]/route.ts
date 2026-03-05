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

        const router = await prisma.router.update({
            where: { id },
            data: {
                name: body.name,
                host: body.host,
                username: body.username,
                password: body.password,
                port: body.port ? parseInt(body.port) : undefined,
                status: body.status?.toUpperCase(),
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
