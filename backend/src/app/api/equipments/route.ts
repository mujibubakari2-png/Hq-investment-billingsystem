import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { parseOptionalDate } from "@/lib/dateUtils";
import { EquipmentCreateSchema } from "@/lib/validators";

// GET /api/equipment
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "equipment:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

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

        const equipment = await db.equipment.findMany({
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
        const guard = requirePermission(req, "equipment:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const body = await req.json();
        const parsed = EquipmentCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { name, type, serialNumber, location, assignedTo, purchaseDate, notes, routerId } = parsed.data;
        const tenantIdValue = userPayload.tenantId;

        const equipment = await db.equipment.create({
            data: {
                name: name || "Unknown Equipment",
                type: type || "OTHER",
                serialNumber: serialNumber || `SN-${Date.now()}`,
                status: "ACTIVE",
                location,
                assignedTo,
                purchaseDate: parseOptionalDate(purchaseDate as any),
                notes,
                routerId,
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

