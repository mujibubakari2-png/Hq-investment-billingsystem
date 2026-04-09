import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const resolvedParams = await params;
        const body = await req.json();
        const { status, usedBy, customer, code } = body;

        const existingVoucher = await prisma.voucher.findUnique({ where: { id: resolvedParams.id } });
        if (!existingVoucher) return errorResponse("Voucher not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && existingVoucher.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const resolvedParams = await params;
        
        const existingVoucher = await prisma.voucher.findUnique({ where: { id: resolvedParams.id } });
        if (!existingVoucher) return errorResponse("Voucher not found", 404);

        if (userPayload.role !== "SUPER_ADMIN" && existingVoucher.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        await prisma.voucher.delete({
            where: { id: resolvedParams.id }
        });
        return jsonResponse({ message: "Voucher deleted successfully" });
    } catch (e: any) {
        console.error("VOUCHER DELETE ERROR:", e);
        return errorResponse(`Failed to delete voucher: ${e.message}`, 500);
    }
}
