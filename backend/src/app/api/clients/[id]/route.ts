import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/clients/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const client = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId },
            include: {
                subscriptions: {
                    include: { package: true, router: true },
                    orderBy: { createdAt: "desc" },
                },
                transactions: { orderBy: { createdAt: "desc" }, take: 20 },
                invoices: { orderBy: { createdAt: "desc" }, take: 10 },
            },
        });

        if (!client) return errorResponse("Client not found", 404);
        return jsonResponse(client);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/clients/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const clientExists = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId }
        });

        if (!clientExists) return errorResponse("Client not found", 404);

        const client = await db.client.update({
            where: { id },
            data: {
                username: body.username, // Allow updating username
                fullName: body.fullName,
                phone: body.phone,
                email: body.email,
                serviceType: body.serviceType === "PPPoE" ? "PPPOE" : "HOTSPOT",
                accountType: body.accountType === "Business" ? "BUSINESS" : "PERSONAL",
                status: body.status?.toUpperCase(),
                macAddress: body.macAddress,
                device: body.device,
            },
        });

        return jsonResponse(client);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/clients/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        
        const clientExists = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId }
        });

        if (!clientExists) return errorResponse("Client not found", 404);

        await db.client.delete({ where: { id } });
        return jsonResponse({ message: "Client deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
