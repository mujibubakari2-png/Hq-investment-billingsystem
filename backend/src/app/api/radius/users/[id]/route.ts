import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

// DELETE /api/radius/users/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "radius:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        await db.radiusUser.delete({ where: { id } });
        return jsonResponse({ message: "RADIUS user deleted" });
    } catch (e) {
        console.error("RADIUS user delete error:", e);
        return errorResponse("Internal server error", 500);
    }
}
