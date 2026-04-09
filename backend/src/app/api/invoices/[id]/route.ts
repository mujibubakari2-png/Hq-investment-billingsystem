import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { parseOptionalDate } from "@/lib/dateUtils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { client: true, items: true },
        });
        if (!invoice) return errorResponse("Invoice not found", 404);
        return jsonResponse(invoice);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        const body = await req.json();

        const invoice = await prisma.invoice.update({
            where: { id },
            data: {
                amount: body.amount ? parseFloat(body.amount) : undefined,
                status: body.status?.toUpperCase(),
                dueDate: parseOptionalDate(body.dueDate),
            },
        });

        return jsonResponse(invoice);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        await prisma.invoice.delete({ where: { id } });
        return jsonResponse({ message: "Invoice deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
