import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";

// GET /api/sms/templates
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "sms:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter } = getTenantFilter(userPayload);

        const templates = await db.messageTemplate.findMany({
            where: filter,
            orderBy: { createdAt: "desc" },
        });

        const mapped = templates.map((t) => ({
            id: t.id,
            name: t.name,
            content: t.content,
            type: t.type.charAt(0) + t.type.slice(1).toLowerCase(),
            variables: t.variables,
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/sms/templates
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "sms:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const tenantId = getAssignTenantId(userPayload);
        const body = await req.json();

        if (!body.name || !body.content) {
            return errorResponse("Name and content are required");
        }

        const template = await db.messageTemplate.create({
            data: {
                name: body.name,
                content: body.content,
                type: (body.type || "CUSTOM").toUpperCase(),
                variables: body.variables || [],
                tenantId,
            },
        });

        return jsonResponse(template, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

