import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getTenantClient } from "@/lib/tenantPrisma";
import { requirePermission } from "@/lib/rbac";

// GET /api/transactions/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "transactions:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
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
