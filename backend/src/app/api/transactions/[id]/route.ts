import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantClient } from "@/lib/tenantPrisma";

// GET /api/transactions/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const transaction = await db.transaction.findUnique({
            where: { id },
            include: { client: true },
        });
        if (!transaction) return errorResponse("Transaction not found", 404);
        return jsonResponse(transaction);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
