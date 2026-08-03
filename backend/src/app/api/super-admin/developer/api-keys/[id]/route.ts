import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);
        await db.apiKey.update({ where: { id: params.id }, data: { deletedAt: new Date(), isActive: false } });
        return jsonResponse({ success: true, message: "API Key revoked" });
    } catch (e) {
        logger.error("SA DELETE API Key Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
