import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";

// GET /api/sms/templates
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { filter } = getTenantFilter(userPayload);

        const templates = await prisma.messageTemplate.findMany({
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const tenantId = getAssignTenantId(userPayload);
        const body = await req.json();

        if (!body.name || !body.content) {
            return errorResponse("Name and content are required");
        }

        const template = await prisma.messageTemplate.create({
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
