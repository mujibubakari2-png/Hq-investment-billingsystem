import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const body = await req.json();
        const existing = await prisma.paymentChannel.findUnique({ where: { id } });
        if (!existing) return errorResponse("Payment channel not found", 404);
        if (userPayload.role !== "SUPER_ADMIN" && existing.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        const channel = await prisma.paymentChannel.update({
            where: { id },
            data: {
                name: body.name,
                provider: body.provider,
                accountNumber: body.accountNumber,
                apiKey: body.apiKey,
                apiSecret: body.apiSecret,
                status: body.status === "Inactive" ? "INACTIVE" : body.status === "Active" ? "ACTIVE" : undefined,
                config: body.config,
            },
        });

        return jsonResponse(channel);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const existing = await prisma.paymentChannel.findUnique({ where: { id } });
        if (!existing) return errorResponse("Payment channel not found", 404);
        if (userPayload.role !== "SUPER_ADMIN" && existing.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        await prisma.paymentChannel.delete({ where: { id } });
        return jsonResponse({ message: "Payment channel deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
