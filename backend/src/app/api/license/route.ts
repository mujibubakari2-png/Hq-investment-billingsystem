import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        if (userPayload.role === "SUPER_ADMIN") {
            return jsonResponse({
                isSuperAdmin: true,
                message: "Super Admin does not require a SaaS license.",
            });
        }

        const tenantId = userPayload.tenantId;
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                plan: true,
                clients: { select: { id: true } },
                tenantInvoices: { orderBy: { createdAt: "desc" } }
            }
        });

        if (!tenant) return errorResponse("Tenant not found", 404);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        
        let daysRemaining = 0;
        let expiresAt = null;

        // If trial exists and is in future, use trial
        if (tenant.trialEnd && tenant.trialEnd > now) {
            daysRemaining = Math.max(0, Math.ceil((tenant.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            expiresAt = tenant.trialEnd;
        } else {
            // Find active paid invoice or logic covering the active subscripton month
            const latestPaidInvoice = tenant.tenantInvoices.find(i => i.status === "PAID");
            if (latestPaidInvoice) {
                // Approximate 30 days from invoice issue if no strict end date is logged natively
                const invEnd = new Date(latestPaidInvoice.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                daysRemaining = Math.max(0, Math.ceil((invEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                expiresAt = invEnd;
            }
        }

        // Calculate Paid This Month
        const paidThisMonth = tenant.tenantInvoices
            .filter(i => i.status === "PAID" && i.createdAt.getTime() >= startOfMonth)
            .reduce((acc, curr) => acc + (curr.amount || 0), 0);

        const outstandingInvoices = tenant.tenantInvoices.filter(i => i.status === "PENDING");

        const payload = {
            isSuperAdmin: false,
            licenseKey: tenant.id.split('-')[0].toUpperCase() + "-" + tenant.id.substring(0, 8),
            status: tenant.status,
            daysRemaining,
            expiresAt: expiresAt ? expiresAt.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }) : "N/A",
            customersCount: tenant.clients.length,
            clientLimit: tenant.plan.clientLimit,
            paidThisMonth,
            outstandingInvoices: outstandingInvoices.map(i => ({
                id: i.id,
                amount: i.amount,
                dueDate: i.dueDate.toLocaleDateString(),
                status: i.status
            })),
            hasOutstanding: outstandingInvoices.length > 0
        };

        return jsonResponse(payload);
    } catch (e) {
        console.error("License API Error:", e);
        return errorResponse("Internal server error", 500);
    }
}
