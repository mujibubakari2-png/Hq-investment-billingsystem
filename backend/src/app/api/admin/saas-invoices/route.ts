import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { toISOSafe } from "@/lib/dateUtils";

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
            dueDate: toISOSafe(inv.dueDate),
            paidAmount: inv.payments.filter(p => p.status === "COMPLETED").reduce((sum, p) => sum + p.amount, 0),
            createdAt: toISOSafe(inv.createdAt)
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
            const invoice = await prisma.tenantInvoice.findUnique({
                where: { id: invoiceId },
                include: { tenant: true }
            });

            if (!invoice) return errorResponse("Invoice not found", 404);

            await prisma.$transaction(async (tx) => {
                await tx.tenantInvoice.update({
                    where: { id: invoiceId },
                    data: { status: "PAID" }
                });

                await tx.tenantPayment.create({
                    data: {
                        invoiceId: invoiceId,
                        tenantId: invoice.tenantId,
                        amount: invoice.amount,
                        transactionId: `MANUAL-${Date.now()}`,
                        status: "COMPLETED",
                        paymentMethod: "MANUAL"
                    }
                });

                const now = new Date();
                let currentExpiry = invoice.tenant.licenseExpiresAt || invoice.tenant.trialEnd || now;
                if (currentExpiry < now) currentExpiry = now;

                const monthsToExtend = invoice.packageMonths || 1;
                const newExpiry = new Date(currentExpiry);
                newExpiry.setMonth(newExpiry.getMonth() + monthsToExtend);

                await tx.tenant.update({
                    where: { id: invoice.tenantId },
                    data: { 
                        status: "ACTIVE",
                        licenseExpiresAt: newExpiry
                    }
                });
            });

            return jsonResponse({ message: "SaaS invoice marked as PAID and tenant activated" });
        }

        if (action === "create") {
            const { tenantId, planId, amount, dueDate, packageMonths } = body;

            // Auto-calculate dueDate: default is 30 days from now if not provided
            const autoDate = new Date();
            autoDate.setDate(autoDate.getDate() + 30);
            const resolvedDueDate = dueDate ? new Date(dueDate) : autoDate;

            const newInvoice = await prisma.tenantInvoice.create({
                data: {
                    tenantId,
                    planId,
                    amount: parseFloat(amount),
                    dueDate: resolvedDueDate,
                    packageMonths: packageMonths ? parseInt(packageMonths) : 1,
                    invoiceNumber: `SAAS-INV-${Date.now()}`,
                    status: "PENDING"
                }
            });
            return jsonResponse({ message: "SaaS invoice created successfully", invoice: newInvoice }, 201);
        }

        // ── Extend License Directly (no invoice needed) ───────────────────────
        if (action === "extend") {
            const { tenantId, months } = body;
            if (!tenantId) return errorResponse("tenantId is required", 400);

            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
            if (!tenant) return errorResponse("Tenant not found", 404);

            const now = new Date();
            const monthsToAdd = months ? parseInt(months) : 1;

            // Extend from current expiry (if in future) or from today
            let baseDate = tenant.licenseExpiresAt || tenant.trialEnd || now;
            if (baseDate < now) baseDate = now;

            const newExpiry = new Date(baseDate);
            newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);

            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    status: "ACTIVE",
                    licenseExpiresAt: newExpiry
                }
            });

            return jsonResponse({
                message: `License extended by ${monthsToAdd} month(s). New expiry: ${newExpiry.toDateString()}`,
                licenseExpiresAt: newExpiry.toISOString()
            });
        }

        return errorResponse("Invalid action provided", 400);

    } catch (e) {
        console.error("ADMIN SAAS INVOICE ACTION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
