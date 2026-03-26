import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const body = await req.json();
        const { status, usedBy, customer, code } = body;

        const updated = await prisma.voucher.update({
            where: { id: resolvedParams.id },
            data: {
                code,
                status,
                usedBy,
                customer: customer ? parseInt(customer) : null
            }
        });

        return jsonResponse(updated);
    } catch (e: any) {
        console.error("VOUCHER UPDATE ERROR:", e);
        return errorResponse(`Failed to update voucher: ${e.message}`, 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        await prisma.voucher.delete({
            where: { id: resolvedParams.id }
        });
        return jsonResponse({ message: "Voucher deleted successfully" });
    } catch (e: any) {
        console.error("VOUCHER DELETE ERROR:", e);
        return errorResponse(`Failed to delete voucher: ${e.message}`, 500);
    }
}
