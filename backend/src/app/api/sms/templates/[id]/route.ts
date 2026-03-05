import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

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
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.messageTemplate.delete({ where: { id } });
        return jsonResponse({ message: "Template deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
