import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        // Authenticate admin (superuser)
        // ... omitted for brevity in this example ...

        const [
            totalTenants,
            activeUsers,
            trialUsers,
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
            activeUsers,
            trialUsers,
            revenue: revenueResult._sum.amount || 0,
            unpaidInvoices
        });

    } catch (e) {
        console.error("ADMIN DASHBOARD ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
