import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/sms/templates
export async function GET() {
    try {
        const templates = await prisma.messageTemplate.findMany({
            orderBy: { createdAt: "desc" },
        });

        const mapped = templates.map((t: {
            id: string;
            name: string;
            content: string;
            type: string;
            variables: string[];
        }) => ({
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
        const body = await req.json();

        const template = await prisma.messageTemplate.create({
            data: {
                name: body.name,
                content: body.content,
                type: (body.type || "CUSTOM").toUpperCase(),
                variables: body.variables || [],
            },
        });

        return jsonResponse(template, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
