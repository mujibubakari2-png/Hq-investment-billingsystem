import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.paymentChannel.delete({ where: { id } });
        return jsonResponse({ message: "Payment channel deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
