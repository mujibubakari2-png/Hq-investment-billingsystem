import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, getUserFromRequest } from "@/lib/auth";


export async function GET(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const [
            totalTenants,
            activeTenants,
            trialTenants,
            revenueResult,
            unpaidInvoices
        ] = await Promise.all([
            prisma.tenant.count(),
            prisma.tenant.count({ where: { status: "ACTIVE" } }),
            prisma.tenant.count({ where: { status: "TRIALLING" } }),
            prisma.tenantPayment.aggregate({
                _sum: { amount: true },
                where: { status: "COMPLETED" }
            }),
            prisma.tenantInvoice.count({ where: { status: "PENDING" } })
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
