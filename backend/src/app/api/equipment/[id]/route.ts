import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const eq = await prisma.equipment.findUnique({
            where: { id },
            include: { router: true },
        });
        if (!eq) return errorResponse("Equipment not found", 404);
        return jsonResponse(eq);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        const eq = await prisma.equipment.update({
            where: { id },
            data: {
                name: body.name,
                type: body.type,
                serialNumber: body.serialNumber,
                status: body.status?.toUpperCase(),
                location: body.location,
                assignedTo: body.assignedTo,
                purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
                notes: body.notes,
                routerId: body.routerId,
            },
        });

        return jsonResponse(eq);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.equipment.delete({ where: { id } });
        return jsonResponse({ message: "Equipment deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
