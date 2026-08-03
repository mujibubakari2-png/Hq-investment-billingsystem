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
        const promo = await db.promotion.update({
            where: { id: params.id },
            data: {
                name: body.name,
                description: body.description,
                type: body.type,
                status: body.status,
                discountValue: body.discountValue !== undefined ? parseFloat(body.discountValue) : undefined,
                startDate: body.startDate ? new Date(body.startDate) : undefined,
                endDate: body.endDate ? new Date(body.endDate) : undefined,
                usageLimit: body.usageLimit !== undefined ? parseInt(body.usageLimit, 10) : undefined,
                updatedBy: guard.user.userId
            }
        });
        return jsonResponse({ success: true, data: promo });
    } catch (e) {
        logger.error("SA PUT Promotion Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);
        await db.promotion.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
        return jsonResponse({ success: true, message: "Promotion deleted" });
    } catch (e) {
        logger.error("SA DELETE Promotion Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
