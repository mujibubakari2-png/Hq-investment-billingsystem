import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/saas-invoices - list all SaaS (Tenant) invoices (Super Admin only)
export async function GET(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const invoices = await prisma.tenantInvoice.findMany({
            include: {
                tenant: { select: { name: true, email: true } },
                plan: { select: { name: true, price: true } },
                payments: true
            },
            orderBy: { createdAt: "desc" }
        });

        const mapped = invoices.map(inv => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            tenantName: inv.tenant.name,
            tenantEmail: inv.tenant.email,
            planName: inv.plan.name,
            amount: inv.amount,
            status: inv.status,
            dueDate: inv.dueDate,
            paidAmount: inv.payments.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + p.amount, 0),
            createdAt: inv.createdAt
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error("ADMIN SAAS INVOICE FETCH ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/admin/saas-invoices - manage SaaS invoices (confirm payment, generate new)
export async function POST(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const body = await req.json();
        const { action, invoiceId, ...data } = body;

        if (action === "confirm_payment") {
            const updated = await prisma.tenantInvoice.update({
                where: { id: invoiceId },
                data: { status: "PAID" }
            });
            return jsonResponse({ message: "SaaS invoice marked as PAID", invoice: updated });
        }

        if (action === "create") {
            const { tenantId, planId, amount, dueDate } = body;
            const newInvoice = await prisma.tenantInvoice.create({
                data: {
                    tenantId,
                    planId,
                    amount: parseFloat(amount),
                    dueDate: new Date(dueDate),
                    invoiceNumber: `SAAS-INV-${Date.now()}`,
                    status: "PENDING"
                }
            });
            return jsonResponse({ message: "SaaS invoice created successfully", invoice: newInvoice }, 201);
        }

        return errorResponse("Invalid action provided", 400);

    } catch (e) {
        console.error("ADMIN SAAS INVOICE ACTION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
