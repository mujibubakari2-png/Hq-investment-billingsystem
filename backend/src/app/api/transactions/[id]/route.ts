import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/transactions/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const transaction = await prisma.transaction.findUnique({
            where: { id },
            include: { client: true },
        });
        if (!transaction) return errorResponse("Transaction not found", 404);
        return jsonResponse(transaction);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
