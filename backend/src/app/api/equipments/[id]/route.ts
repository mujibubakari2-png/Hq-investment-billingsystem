import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";
import { parseOptionalDate } from "@/lib/dateUtils";
import { EquipmentUpdateSchema } from "@/lib/validators";
import logger from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "equipment:read");
        if (guard.error) return guard.error;

        const { id } = await params;
        const db = getTenantClient(guard.user);
        const eq = await db.equipment.findUnique({
            where: { id },
            include: { router: true },
        });
        if (!eq) return errorResponse("Equipment not found", 404);
        if (!canAccessTenant(guard.user, eq.tenantId)) return errorResponse("Equipment not found", 404);
        return jsonResponse(eq);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "equipment:write");
        if (guard.error) return guard.error;
        const currentUser = guard.user;
        const db = getTenantClient(currentUser);

        const { id } = await params;
        const body = await req.json();

        const parsed = EquipmentUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }

        const existing = await db.equipment.findFirst({ where: { id } });
        if (!existing) return errorResponse("Equipment not found", 404);
        if (!canAccessTenant(currentUser, existing.tenantId)) return errorResponse("Equipment not found", 404);

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

        const eq = await db.equipment.update({ where: { id }, data: dataToUpdate });
        return jsonResponse(eq);
    } catch (err) {
        logger.error("[route] error", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "equipment:delete");
        if (guard.error) return guard.error;
        const currentUser = guard.user;
        const db = getTenantClient(currentUser);

        const { id } = await params;
        const existing = await db.equipment.findFirst({ where: { id } });
        if (!existing) return errorResponse("Equipment not found", 404);
        if (!canAccessTenant(currentUser, existing.tenantId)) return errorResponse("Equipment not found", 404);

        await db.equipment.delete({ where: { id } });
        return jsonResponse({ message: "Equipment deleted" });
    } catch (err) {
        logger.error("[route] error", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Internal server error", 500);
    }
}
