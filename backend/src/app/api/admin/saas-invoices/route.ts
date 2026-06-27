import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { toISOSafe } from "@/lib/dateUtils";
import { isPlatformSuperAdmin } from "@/lib/tenant";


// GET /api/admin/saas-invoices - list all SaaS licenses as invoices (Paid, Unpaid, Overdue)
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const user = guard.user;
        if (!isPlatformSuperAdmin(user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(null);

        // Fetch all tenants to show the current license status for EVERY tenant
        const tenants = await db.tenant.findMany({
            include: {
                plan: { select: { name: true, price: true } },
                tenantInvoices: {
                    include: { payments: true },
                    orderBy: { createdAt: "desc" },
                    take: 1
                }
            },
            orderBy: { createdAt: "desc" }
        });

        const mapped = tenants.map(t => {
            const latestInvoice = t.tenantInvoices[0];
            const now = new Date();
            const expires = t.licenseExpiresAt || t.trialEnd;
            
            let status = "PENDING";
            
            if (latestInvoice) {
                status = latestInvoice.status;
                if (status === "PENDING" && latestInvoice.dueDate && latestInvoice.dueDate < now) {
                    status = "OVERDUE";
                }
            } else {
                // If the license is active and hasn't expired, it is PAID
                if (expires && expires > now) {
                    status = "PAID";
                } else {
                    status = "OVERDUE";
                }
            }

            return {
                id: latestInvoice ? latestInvoice.id : t.id,
                invoiceNumber: latestInvoice ? latestInvoice.invoiceNumber : `LIC-${t.id.slice(0,8).toUpperCase()}`,
                tenantName: t.name,
                tenantEmail: t.email,
                planName: t.plan ? t.plan.name : "Unknown Plan",
                amount: latestInvoice ? latestInvoice.amount : (t.plan ? t.plan.price : 0),
                status: status,
                dueDate: latestInvoice?.dueDate ? toISOSafe(latestInvoice.dueDate) : (expires ? toISOSafe(expires) : toISOSafe(now)),
                paidAmount: status === "PAID" ? (latestInvoice ? latestInvoice.amount : (t.plan ? t.plan.price : 0)) : 0,
                createdAt: latestInvoice ? toISOSafe(latestInvoice.createdAt) : toISOSafe(t.createdAt)
            };
        });

        return jsonResponse(mapped);
    } catch (e) {
        console.error("ADMIN SAAS INVOICE FETCH ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/admin/saas-invoices - manage SaaS invoices (confirm payment, generate new)
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const user = guard.user;
        if (!isPlatformSuperAdmin(user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);
        const db = getTenantClient(null);

        const body = await req.json();
        const { action, invoiceId, ...data } = body;

        if (action === "confirm_payment") {
            const invoice = await db.tenantInvoice.findUnique({
                where: { id: invoiceId },
                include: { tenant: true }
            });

            if (!invoice) return errorResponse("Invoice not found", 404);

            await db.$transaction(async (tx) => {
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

            const newInvoice = await db.tenantInvoice.create({
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

            const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
            if (!tenant) return errorResponse("Tenant not found", 404);

            const now = new Date();
            const monthsToAdd = months ? parseInt(months) : 1;

            // Extend from current expiry (if in future) or from today
            let baseDate = tenant.licenseExpiresAt || tenant.trialEnd || now;
            if (baseDate < now) baseDate = now;

            const newExpiry = new Date(baseDate);
            newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);

            await db.tenant.update({
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
