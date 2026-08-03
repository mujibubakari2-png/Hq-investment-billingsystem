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
        const customer = await db.ecomCustomer.update({
            where: { id: params.id },
            data: {
                name: body.name,
                email: body.email,
                phone: body.phone,
                status: body.status,
                notes: body.notes,
                updatedBy: guard.user.userId
            }
        });
        return jsonResponse({ success: true, data: customer });
    } catch (e) {
        logger.error("SA PUT Customer Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);
        await db.ecomCustomer.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
        return jsonResponse({ success: true, message: "Customer deleted" });
    } catch (e) {
        logger.error("SA DELETE Customer Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
