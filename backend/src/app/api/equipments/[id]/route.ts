import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantClient } from "@/lib/tenantPrisma";
import { parseOptionalDate } from "@/lib/dateUtils";
import { EquipmentUpdateSchema } from "@/lib/validators";

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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const parsed = EquipmentUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const existing = await prisma.equipment.findFirst({ where: isSuperAdmin ? { id } : { id, tenantId: userPayload.tenantId } });
        if (!existing) return errorResponse("Equipment not found", 404);

        const update = parsed.data;
        const dataToUpdate: any = {};
        if (update.name) dataToUpdate.name = update.name;
        if (update.type) dataToUpdate.type = update.type;
        if (update.serialNumber) dataToUpdate.serialNumber = update.serialNumber;
        if (update.status) dataToUpdate.status = update.status?.toUpperCase();
        if (update.location) dataToUpdate.location = update.location;
        if (update.assignedTo) dataToUpdate.assignedTo = update.assignedTo;
        if (update.purchaseDate) dataToUpdate.purchaseDate = parseOptionalDate(update.purchaseDate as any);
        if (update.notes) dataToUpdate.notes = update.notes;
        if (update.routerId) dataToUpdate.routerId = update.routerId;

        const eq = await prisma.equipment.update({ where: { id }, data: dataToUpdate });
        return jsonResponse(eq);
    } catch (err) {
        console.error(err);
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const existing = await prisma.equipment.findFirst({ where: userPayload.role === "SUPER_ADMIN" ? { id } : { id, tenantId: userPayload.tenantId } });
        if (!existing) return errorResponse("Equipment not found", 404);

        if (userPayload.role === "VIEWER") return errorResponse("Forbidden", 403);

        await prisma.equipment.delete({ where: { id } });
        return jsonResponse({ message: "Equipment deleted" });
    } catch (err) {
        console.error(err);
        return errorResponse("Internal server error", 500);
    }
}
