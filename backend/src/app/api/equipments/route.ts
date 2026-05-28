import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { parseOptionalDate } from "@/lib/dateUtils";

// GET /api/equipment
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { serialNumber: { contains: search, mode: "insensitive" } },
                { type: { contains: search, mode: "insensitive" } },
            ];
        }

        const equipment = await prisma.equipment.findMany({
            where,
            include: { router: { select: { name: true } }, tenant: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
        });

        return jsonResponse(equipment);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/equipment
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const body = await req.json();
        const tenantIdValue = userPayload.tenantId;

        const equipment = await prisma.equipment.create({
            data: {
                name: body.name || body.model || "Unknown Equipment",
                type: body.type || "OTHER",
                serialNumber: body.serialNumber || body.serial_number || `SN-${Date.now()}`,
                status: (body.status || "ACTIVE").toUpperCase() as any,
                location: body.location,
                assignedTo: body.assignedTo,
                purchaseDate: parseOptionalDate(body.purchaseDate),
                notes: body.notes,
                routerId: body.routerId,
                tenantId: tenantIdValue
            },
        });

        return jsonResponse({
            ...equipment,
            model: equipment.name, // Alias for TestSprite
            serial_number: equipment.serialNumber, // Alias for TestSprite
        }, 201);
    } catch (e) {
        console.error("EQUIPMENT POST ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
