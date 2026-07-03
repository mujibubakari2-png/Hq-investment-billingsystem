import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import logger from "@/lib/logger";

// DELETE /api/radius/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "radius:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const existing = await db.radiusUser.findUnique({ where: { id } });
        if (!existing) return errorResponse("RADIUS user not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("RADIUS user not found", 404);

        await db.radiusUser.delete({ where: { id } });
        return jsonResponse({ message: "RADIUS user deleted" });
    } catch (e) {
        logger.error("RADIUS user delete error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
