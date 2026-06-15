import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { ClientUpdateSchema } from "@/lib/validators";

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
        const parsed = ClientUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data;

        const clientExists = await db.client.findFirst({
            where: { id, tenantId: userPayload.tenantId }
        });

        if (!clientExists) return errorResponse("Client not found", 404);

        const dataToUpdate: any = {};
        if (update.username) dataToUpdate.username = update.username;
        if (update.fullName) dataToUpdate.fullName = update.fullName;
        if (update.phone) dataToUpdate.phone = update.phone;
        if (update.email) dataToUpdate.email = update.email;
        if (update.serviceType) dataToUpdate.serviceType = update.serviceType;
        if (update.accountType) dataToUpdate.accountType = update.accountType;
        if (update.status) dataToUpdate.status = update.status?.toUpperCase();
        if (update.macAddress) dataToUpdate.macAddress = update.macAddress;
        if (update.device) dataToUpdate.device = update.device;

        const client = await db.client.update({ where: { id }, data: dataToUpdate });

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

        const clientExists = await db.client.findFirst({ where: { id, tenantId: userPayload.tenantId } });
        if (!clientExists) return errorResponse("Client not found", 404);

        // RBAC: Prevent VIEWER role from deleting clients
        if (userPayload.role === "VIEWER") return errorResponse("Forbidden", 403);

        await db.client.delete({ where: { id } });
        return jsonResponse({ message: "Client deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
