import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "sms:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        // Verify template exists
        const existing = await db.messageTemplate.findUnique({ where: { id } });
        if (!existing) return errorResponse("Template not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && existing.tenantId !== userPayload.tenantId) {
            return errorResponse("Template not found", 404);
        }

        const template = await db.messageTemplate.update({
            where: { id },
            data: {
                name: body.name,
                content: body.content,
                type: body.type?.toUpperCase(),
                variables: body.variables,
            },
        });

        return jsonResponse(template);
    } catch (e) {
        console.error("TEMPLATE UPDATE ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "sms:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;

        // Verify template exists
        const existing = await db.messageTemplate.findUnique({ where: { id } });
        if (!existing) return errorResponse("Template not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && existing.tenantId !== userPayload.tenantId) {
            return errorResponse("Template not found", 404);
        }

        await db.messageTemplate.delete({ where: { id } });
        return jsonResponse({ message: "Template deleted" });
    } catch (e) {
        console.error("TEMPLATE DELETE ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
