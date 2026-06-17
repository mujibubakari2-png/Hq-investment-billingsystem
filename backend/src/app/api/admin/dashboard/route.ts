import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse, getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const db = getTenantClient(null);
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN" || user.tenantId) {
            return errorResponse("Forbidden: Platform Admin access required", 403);
        }

        const [
            totalTenants,
            activeTenants,
            trialTenants,
            revenueResult,
            unpaidInvoices
        ] = await Promise.all([
            db.tenant.count(),
            db.tenant.count({ where: { status: "ACTIVE" } }),
            db.tenant.count({ where: { status: "TRIALLING" } }),
            db.tenantPayment.aggregate({
                _sum: { amount: true },
                where: { status: "COMPLETED" }
            }),
            db.tenantInvoice.count({ where: { status: "PENDING" } })
        ]);

        return jsonResponse({
            totalTenants,
            activeTenants,
            trialTenants,
            revenue: revenueResult._sum.amount || 0,
            unpaidInvoices
        });

    } catch (e) {
        console.error("ADMIN DASHBOARD ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

