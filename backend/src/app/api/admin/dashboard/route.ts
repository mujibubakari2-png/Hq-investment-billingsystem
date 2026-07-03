import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const db = getTenantClient(null);

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
        logger.error("ADMIN DASHBOARD ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

