import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/clients/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const client = await prisma.client.findUnique({
            where: { id },
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
        const { id } = await params;
        const body = await req.json();

        const client = await prisma.client.update({
            where: { id },
            data: {
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
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.client.delete({ where: { id } });
        return jsonResponse({ message: "Client deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
