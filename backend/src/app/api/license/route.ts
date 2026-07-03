import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toISOSafe } from "@/lib/dateUtils";
import { getJwtTenantId, isPlatformSuperAdmin } from "@/lib/tenant";
import { getSubUserLimitForPlan } from "@/lib/userLimits";
import logger from "@/lib/logger";

export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "license:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        if (isPlatformSuperAdmin(userPayload)) {
            return jsonResponse({
                isSuperAdmin: true,
                message: "Super Admin does not require a SaaS license.",
            });
        }

        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            include: {
                plan: true,
                clients: { select: { id: true } },
                users: {
                    where: { role: { in: ["ADMIN", "AGENT", "VIEWER"] } },
                    select: { id: true },
                },
                tenantInvoices: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        plan: true,
                        payments: { orderBy: { createdAt: "desc" } },
                    },
                }
            }
        });

        if (!tenant) return errorResponse("Tenant not found", 404);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let daysRemaining = 0;
        let expiresAt: Date | null = tenant.licenseExpiresAt || tenant.trialEnd || null;
        const hasAnyExpiry = !!(tenant.licenseExpiresAt || tenant.trialEnd);

        const isNotExpired = (date: Date) => {
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            return endOfDay >= now;
        };

        if (tenant.licenseExpiresAt && isNotExpired(tenant.licenseExpiresAt)) {
            const endOfDay = new Date(tenant.licenseExpiresAt);
            endOfDay.setHours(23, 59, 59, 999);
            daysRemaining = Math.max(1, Math.ceil((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            expiresAt = tenant.licenseExpiresAt;
        } else if (tenant.trialEnd && isNotExpired(tenant.trialEnd)) {
            const endOfDay = new Date(tenant.trialEnd);
            endOfDay.setHours(23, 59, 59, 999);
            daysRemaining = Math.max(1, Math.ceil((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
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
            await db.tenant.update({ where: { id: tenant.id }, data: { status: "SUSPENDED" } });
            currentStatus = "SUSPENDED";
        }

        // Auto-create pending invoice if within 5 days of expiry and none exists
        if (daysRemaining > 0 && daysRemaining <= 5 && expiresAt) {
            const hasPending = tenant.tenantInvoices.some(i => i.status === "PENDING");
            if (!hasPending) {
                const invoiceNumber = `INV-${new Date().getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
                const newInvoice = await db.tenantInvoice.create({
                    data: {
                        invoiceNumber,
                        tenantId: tenant.id,
                        planId: tenant.planId,
                        packageMonths: 1,
                        amount: tenant.plan.price,
                        status: "PENDING",
                        dueDate: expiresAt,
                    },
                    include: { plan: true, payments: true }
                });
                tenant.tenantInvoices.unshift(newInvoice);
            }
        }

        // Calculate Paid This Month
        const paidThisMonth = tenant.tenantInvoices
            .filter(i => i.status === "PAID" && i.createdAt.getTime() >= startOfMonth)
            .reduce((acc, curr) => acc + (curr.amount || 0), 0);

        // outstandingInvoices: PENDING invoices whose due date has already passed
        const outstandingInvoices = tenant.tenantInvoices.filter(
            i => i.status === "PENDING" && i.dueDate && i.dueDate <= now
        );

        // pendingInvoices: ALL PENDING invoices (including future-dated auto-generated ones)
        // The frontend RenewLicense page uses this to show the "Pay Generated Invoice" flow.
        const pendingInvoices = tenant.tenantInvoices.filter(
            i => i.status === "PENDING"
        );

        const globalSettings = await db.systemSetting.findMany({ where: { tenantId: null } });
        const appNameSetting = globalSettings.find(s => s.key === "companyName" || s.key === "appName");
        const supportPhoneSetting = globalSettings.find(s => s.key === "supportPhone" || s.key === "phone");
        const platformName = appNameSetting?.value || process.env.APP_NAME || "HQ INVESTMENT";
        const platformPhone = supportPhoneSetting?.value || "+255787109988";

        const payload = {
            isSuperAdmin: false,
            platformName,
            platformPhone,
            companyName: tenant.name,
            companyLogo: tenant.logoUrl,
            tenantSlug: tenant.slug,
            licenseKey: tenant.id.split('-')[0].toUpperCase() + "-" + tenant.id.substring(0, 8),
            status: currentStatus,
            daysRemaining,
            expiresAt: toISOSafe(expiresAt),
            customersCount: tenant.clients.length,
            pppoeLimit: tenant.plan.pppoeLimit,
            hotspotLimit: tenant.plan.hotspotLimit,
            maxRouters: tenant.plan.maxRouters,
            subUsersCount: tenant.users.length,
            subUsersLimit: getSubUserLimitForPlan(tenant.plan.name),
            paidThisMonth,
            plan: {
                id: tenant.plan.id,
                name: tenant.plan.name,
                price: tenant.plan.price
            },
            outstandingInvoices: outstandingInvoices.map(i => ({
                id: i.id,
                invoiceNumber: i.invoiceNumber,
                invoiceDate: toISOSafe(i.createdAt),
                paymentDate: toISOSafe(i.payments.find(p => p.status === "COMPLETED")?.createdAt ?? null),
                licensePackage: i.plan.name,
                amount: i.amount,
                dueDate: toISOSafe(i.dueDate),
                status: i.status
            })),
            // pendingInvoices: all PENDING invoices (past-due AND future-dated).
            // Used by the frontend RenewLicense page to show the "Pay Generated Invoice" option.
            pendingInvoices: pendingInvoices.map(i => ({
                id: i.id,
                invoiceNumber: i.invoiceNumber,
                invoiceDate: toISOSafe(i.createdAt),
                paymentDate: toISOSafe(i.payments.find(p => p.status === "COMPLETED")?.createdAt ?? null),
                licensePackage: i.plan.name,
                amount: i.amount,
                dueDate: toISOSafe(i.dueDate),
                status: i.status
            })),
            billingHistory: tenant.tenantInvoices.map(i => ({
                id: i.id,
                invoiceNumber: i.invoiceNumber,
                invoiceDate: toISOSafe(i.createdAt),
                paymentDate: toISOSafe(i.payments.find(p => p.status === "COMPLETED")?.createdAt ?? null),
                licensePackage: i.plan.name,
                amount: i.amount,
                dueDate: toISOSafe(i.dueDate),
                status: i.status,
            })),
            hasOutstanding: pendingInvoices.length > 0,
            hasPending: pendingInvoices.length > 0,
            totalOutstanding: pendingInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
        };

        return jsonResponse(payload);
    } catch (e) {
        logger.error("License API Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

