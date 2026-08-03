import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);
        const body = await req.json();
        const menu = await db.menu.update({
            where: { id: params.id },
            data: {
                name: body.name,
                slug: body.slug,
                description: body.description,
                isActive: body.isActive,
                updatedBy: guard.user.userId
            }
        });
        return jsonResponse({ success: true, data: menu });
    } catch (e) {
        logger.error("SA PUT Menu Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);
        await db.menu.delete({ where: { id: params.id } });
        return jsonResponse({ success: true, message: "Menu deleted" });
    } catch (e) {
        logger.error("SA DELETE Menu Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
