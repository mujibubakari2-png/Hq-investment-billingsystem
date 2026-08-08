import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

/**
 * GET  /api/super-admin/invoices    — list all platform (SaaS) invoices
 * POST /api/super-admin/invoices    — create invoice OR confirm manual payment
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * These are PLATFORM invoices (TenantInvoice) — the bills that the platform
 * sends to TENANTS for their license subscriptions.
 * This is NOT the same as tenant's own client invoices (Invoice model).
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const tenantId = searchParams.get("tenantId") || "";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Prisma.TenantInvoiceWhereInput = {};
        if (status) where.status = status as Prisma.EnumTenantInvoiceStatusFilter<"TenantInvoice">;
        if (tenantId) where.tenantId = tenantId;

        const [invoices, total] = await Promise.all([
            db.tenantInvoice.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: {
                    tenant: { select: { id: true, name: true, email: true, status: true } },
                    plan: { select: { id: true, name: true, price: true } },
                    payments: {
                        select: { id: true, amount: true, paymentMethod: true, status: true, createdAt: true, transactionId: true },
                        orderBy: { createdAt: "desc" },
                    },
                },
            }),
            db.tenantInvoice.count({ where }),
        ]);

        const now = new Date();

        return jsonResponse({
            data: invoices.map((inv) => {
                // Compute effective status (PENDING past dueDate = OVERDUE)
                let effectiveStatus = inv.status;
                if (effectiveStatus === "PENDING" && inv.dueDate && inv.dueDate < now) {
                    effectiveStatus = "OVERDUE";
                }
                return {
                    id: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    tenantId: inv.tenantId,
                    tenantName: inv.tenant.name,
                    tenantEmail: inv.tenant.email,
                    tenantStatus: inv.tenant.status,
                    planId: inv.planId,
                    planName: inv.plan.name,
                    planPrice: Number(inv.plan.price),
                    amount: Number(inv.amount),
                    packageMonths: inv.packageMonths,
                    status: effectiveStatus,
                    dueDate: inv.dueDate,
                    createdAt: inv.createdAt,
                    updatedAt: inv.updatedAt,
                    payments: inv.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
                };
            }),
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        });
    } catch (e) {
        logger.error("Super Admin GET Invoices Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        const { action } = body;

        if (action === "create") {
            const { tenantId, planId, amount, dueDate, packageMonths } = body;
            if (!tenantId || !planId || !amount) {
                return errorResponse("tenantId, planId, and amount are required", 400);
            }

            const autoDate = new Date();
            autoDate.setDate(autoDate.getDate() + 30);
            const resolvedDueDate = dueDate ? new Date(dueDate) : autoDate;

            const invoice = await db.tenantInvoice.create({
                data: {
                    tenantId,
                    planId,
                    amount: parseFloat(amount),
                    dueDate: resolvedDueDate,
                    packageMonths: packageMonths ? parseInt(packageMonths) : 1,
                    invoiceNumber: `SAAS-${Date.now()}`,
                    status: "PENDING",
                },
            });

            await writeAuditLog({
                tenantId,
                userId: guard.user.userId,
                action: "PLATFORM_CREATE_INVOICE",
                resource: "TenantInvoice",
                resourceId: invoice.id,
                details: { amount, planId, dueDate: resolvedDueDate },
                ipAddress: getIpFromRequest(req),
            }).catch(() => {});

            return jsonResponse({ message: "Invoice created", invoice }, 201);
        }

        if (action === "confirm_payment") {
            const { invoiceId } = body;
            if (!invoiceId) return errorResponse("invoiceId is required", 400);

            const invoice = await db.tenantInvoice.findUnique({
                where: { id: invoiceId },
                include: { tenant: true, plan: true },
            });
            if (!invoice) return errorResponse("Invoice not found", 404);
            if (invoice.status === "PAID") return errorResponse("Invoice is already paid", 409);

            await db.$transaction(async (tx) => {
                await tx.tenantInvoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });

                await tx.tenantPayment.create({
                    data: {
                        invoiceId,
                        tenantId: invoice.tenantId,
                        amount: invoice.amount,
                        transactionId: `MANUAL-${Date.now()}`,
                        status: "COMPLETED",
                        paymentMethod: "MANUAL",
                    },
                });

                const now = new Date();
                const months = invoice.packageMonths || 1;
                let base = invoice.tenant.licenseExpiresAt || invoice.tenant.trialEnd || now;
                if (base < now) base = now;
                const newExpiry = new Date(base);
                newExpiry.setMonth(newExpiry.getMonth() + months);

                await tx.tenant.update({
                    where: { id: invoice.tenantId },
                    data: { status: "ACTIVE", licenseExpiresAt: newExpiry },
                });
            });

            await writeAuditLog({
                tenantId: invoice.tenantId,
                userId: guard.user.userId,
                action: "PLATFORM_CONFIRM_INVOICE_PAYMENT",
                resource: "TenantInvoice",
                resourceId: invoiceId,
                details: { amount: Number(invoice.amount), planName: invoice.plan.name },
                ipAddress: getIpFromRequest(req),
            }).catch(() => {});

            return jsonResponse({ message: `Invoice confirmed as PAID. Tenant activated.` });
        }

        return errorResponse("Invalid action. Use 'create' or 'confirm_payment'.", 400);
    } catch (e) {
        logger.error("Super Admin POST Invoice Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
