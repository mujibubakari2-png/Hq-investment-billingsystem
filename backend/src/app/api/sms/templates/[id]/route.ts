import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const body = await req.json();

        // Verify template exists
        const existing = await prisma.messageTemplate.findUnique({ where: { id } });
        if (!existing) return errorResponse("Template not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && existing.tenantId !== userPayload.tenantId) {
            return errorResponse("Template not found", 404);
        }

        const template = await prisma.messageTemplate.update({
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;

        // Verify template exists
        const existing = await prisma.messageTemplate.findUnique({ where: { id } });
        if (!existing) return errorResponse("Template not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && existing.tenantId !== userPayload.tenantId) {
            return errorResponse("Template not found", 404);
        }

        await prisma.messageTemplate.delete({ where: { id } });
        return jsonResponse({ message: "Template deleted" });
    } catch (e) {
        console.error("TEMPLATE DELETE ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
