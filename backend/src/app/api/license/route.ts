import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { toISOSafe } from "@/lib/dateUtils";

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
        let expiresAt: Date | null = tenant.licenseExpiresAt || tenant.trialEnd || null;
        const hasAnyExpiry = !!(tenant.licenseExpiresAt || tenant.trialEnd);

        if (tenant.licenseExpiresAt && tenant.licenseExpiresAt > now) {
            daysRemaining = Math.max(0, Math.ceil((tenant.licenseExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            expiresAt = tenant.licenseExpiresAt;
        } else if (tenant.trialEnd && tenant.trialEnd > now) {
            daysRemaining = Math.max(0, Math.ceil((tenant.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            expiresAt = tenant.trialEnd;
        } else {
            if (tenant.licenseExpiresAt) expiresAt = tenant.licenseExpiresAt;
            else if (tenant.trialEnd) expiresAt = tenant.trialEnd;
            // If no expiry date at all, keep daysRemaining = 0 but don't auto-suspend
        }

        let currentStatus = tenant.status;
        // Auto-suspend if the tenant HAS an expiry date that has passed.
        // Covers both ACTIVE and TRIALLING tenants (trial ended = suspended).
        const canAutoSuspend = currentStatus === "ACTIVE" || currentStatus === "TRIALLING";
        if (hasAnyExpiry && daysRemaining <= 0 && canAutoSuspend) {
            await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });
            currentStatus = "SUSPENDED";
        }

        // Calculate Paid This Month
        const paidThisMonth = tenant.tenantInvoices
            .filter(i => i.status === "PAID" && i.createdAt.getTime() >= startOfMonth)
            .reduce((acc, curr) => acc + (curr.amount || 0), 0);

        // Only flag invoices as "outstanding" if their due date has actually passed
        const outstandingInvoices = tenant.tenantInvoices.filter(
            i => i.status === "PENDING" && i.dueDate && i.dueDate <= now
        );

        const payload = {
            isSuperAdmin: false,
            companyName: tenant.name,
            licenseKey: tenant.id.split('-')[0].toUpperCase() + "-" + tenant.id.substring(0, 8),
            status: currentStatus,
            daysRemaining,
            expiresAt: toISOSafe(expiresAt),
            customersCount: tenant.clients.length,
            clientLimit: tenant.plan.clientLimit,
            paidThisMonth,
            plan: {
                id: tenant.plan.id,
                name: tenant.plan.name,
                price: tenant.plan.price
            },
            outstandingInvoices: outstandingInvoices.map(i => ({
                id: i.id,
                amount: i.amount,
                dueDate: toISOSafe(i.dueDate),
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
