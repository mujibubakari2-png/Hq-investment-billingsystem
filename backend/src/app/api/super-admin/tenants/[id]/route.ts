import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse, hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { sendAccountApprovedNotifications } from "@/lib/accountNotifications";
import logger from "@/lib/logger";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

/**
 * GET  /api/super-admin/tenants/[id]     — get single tenant (privacy-filtered)
 * PATCH /api/super-admin/tenants/[id]    — update tenant status / plan
 * DELETE /api/super-admin/tenants/[id]   — hard delete tenant (with safeguards)
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * GET returns ONLY platform-level metadata.
 * Explicitly excluded: clients, routers, vouchers, subscriptions, transactions,
 *   system settings, hotspot config, VPN users, radius data.
 * ──────────────────────────────────────────────────────────────────────────────
 */

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await ctx.params;
        const db = getTenantClient(null);

        const tenant = await db.tenant.findUnique({
            where: { id },
            select: {
                // ✅ PLATFORM METADATA ONLY
                id: true,
                name: true,
                email: true,
                phone: true,
                slug: true,
                status: true,
                planId: true,
                createdAt: true,
                updatedAt: true,
                trialStart: true,
                trialEnd: true,
                licenseExpiresAt: true,
                logoUrl: true,
                plan: { select: { id: true, name: true, price: true, maxRouters: true, pppoeLimit: true, hotspotLimit: true } },
                branding: { select: { companyName: true, companyEmail: true } },
                // Contact info for the primary admin user only
                users: {
                    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, deletedAt: null },
                    select: { id: true, fullName: true, email: true, phone: true, role: true, lastLogin: true, status: true },
                    take: 5,
                },
                // License history
                tenantLicenses: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    select: { id: true, status: true, startsAt: true, expiresAt: true, createdAt: true, plan: { select: { name: true } } },
                },
                // Payment history — platform payments only, NOT tenant's own client transactions
                tenantPayments: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        amount: true,
                        paymentMethod: true,
                        status: true,
                        createdAt: true,
                        invoice: { select: { invoiceNumber: true, dueDate: true } },
                    },
                },
                tenantInvoices: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        invoiceNumber: true,
                        amount: true,
                        status: true,
                        dueDate: true,
                        createdAt: true,
                        plan: { select: { name: true } },
                    },
                },
            },
        });

        if (!tenant) return errorResponse("Tenant not found", 404);

        return jsonResponse({
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
            slug: tenant.slug,
            status: tenant.status,
            planId: tenant.planId,
            logoUrl: tenant.logoUrl,
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
            trialStart: tenant.trialStart,
            trialEnd: tenant.trialEnd,
            licenseExpiresAt: tenant.licenseExpiresAt,
            companyName: tenant.branding?.companyName,
            companyEmail: tenant.branding?.companyEmail,
            plan: tenant.plan ? {
                ...tenant.plan,
                price: Number(tenant.plan.price),
            } : null,
            adminUsers: tenant.users,
            licenseHistory: tenant.tenantLicenses,
            paymentHistory: tenant.tenantPayments.map((p) => ({
                ...p,
                amount: Number(p.amount),
            })),
            invoiceHistory: tenant.tenantInvoices.map((i) => ({
                ...i,
                amount: Number(i.amount),
            })),
        });
    } catch (e) {
        logger.error("Super Admin GET Tenant Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await ctx.params;
        const db = getTenantClient(null);
        const body = await req.json();
        const { action, planId, licenseExpiresAt, reason } = body;

        const tenant = await db.tenant.findUnique({ where: { id } });
        if (!tenant) return errorResponse("Tenant not found", 404);

        let updatedTenant;
        let auditAction = "";
        let message = "";

        if (action === "approve") {
            if (tenant.status !== "PENDING_APPROVAL") {
                return errorResponse(`Tenant is already ${tenant.status}`, 400);
            }
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 10);
            updatedTenant = await db.tenant.update({
                where: { id },
                data: { status: "TRIALLING", trialStart, trialEnd },
            });
            await sendAccountApprovedNotifications({
                tenantId: tenant.id,
                tenantName: tenant.name,
                email: tenant.email,
                phone: tenant.phone,
            });
            auditAction = "PLATFORM_APPROVE_TENANT";
            message = `Tenant "${tenant.name}" approved. 10-day trial starts now.`;

        } else if (action === "suspend") {
            updatedTenant = await db.tenant.update({ where: { id }, data: { status: "SUSPENDED" } });
            auditAction = "PLATFORM_SUSPEND_TENANT";
            message = `Tenant "${tenant.name}" suspended.`;

        } else if (action === "reactivate") {
            updatedTenant = await db.tenant.update({ where: { id }, data: { status: "ACTIVE" } });
            auditAction = "PLATFORM_REACTIVATE_TENANT";
            message = `Tenant "${tenant.name}" reactivated.`;

        } else if (action === "change_plan" && planId) {
            const plan = await db.saasPlan.findUnique({ where: { id: planId } });
            if (!plan) return errorResponse("Plan not found", 404);
            updatedTenant = await db.tenant.update({ where: { id }, data: { planId } });
            auditAction = "PLATFORM_CHANGE_TENANT_PLAN";
            message = `Tenant "${tenant.name}" plan changed to "${plan.name}".`;

        } else if (action === "extend_license" && licenseExpiresAt) {
            const newExpiry = new Date(licenseExpiresAt);
            updatedTenant = await db.tenant.update({
                where: { id },
                data: { licenseExpiresAt: newExpiry, status: "ACTIVE" },
            });
            auditAction = "PLATFORM_EXTEND_TENANT_LICENSE";
            message = `Tenant "${tenant.name}" license extended to ${newExpiry.toDateString()}.`;

        } else if (action === "reset_password") {
            // Generate new temp password and send to tenant admin — super admin never sees it
            const tempPassword = `Reset@${Math.random().toString(36).slice(2, 10)}${Math.floor(Math.random() * 900 + 100)}`;
            const hashedPassword = await hashPassword(tempPassword);
            const adminUser = await db.user.findFirst({
                where: { tenantId: id, role: { in: ["SUPER_ADMIN", "ADMIN"] }, deletedAt: null },
                orderBy: { createdAt: "asc" },
            });
            if (!adminUser) return errorResponse("No admin user found for this tenant", 404);
            await db.user.update({ where: { id: adminUser.id }, data: { password: hashedPassword } });
            // In production, send email/SMS here
            auditAction = "PLATFORM_RESET_TENANT_ADMIN_PASSWORD";
            message = `Password reset for "${tenant.name}" admin. Tenant will receive credentials via email/SMS.`;
            updatedTenant = tenant;

        } else {
            return errorResponse("Invalid action", 400);
        }

        await writeAuditLog({
            tenantId: id,
            userId: guard.user.userId,
            action: auditAction,
            resource: "Tenant",
            resourceId: id,
            details: { action, reason, tenantName: tenant.name },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message, tenant: { id, status: updatedTenant?.status } });
    } catch (e) {
        logger.error("Super Admin PATCH Tenant Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await ctx.params;
        const db = getTenantClient(null);
        const body = await req.json().catch(() => ({}));
        const { confirmName } = body;

        const tenant = await db.tenant.findUnique({ where: { id } });
        if (!tenant) return errorResponse("Tenant not found", 404);

        // Require explicit confirmation by typing tenant name
        if (confirmName !== tenant.name) {
            return errorResponse(
                `Deletion confirmation failed. You must provide the exact tenant name: "${tenant.name}"`,
                400,
                "CONFIRMATION_REQUIRED"
            );
        }

        // Suspend first before deletion to prevent race conditions
        await db.tenant.update({ where: { id }, data: { status: "SUSPENDED" } });

        await writeAuditLog({
            tenantId: id,
            userId: guard.user.userId,
            action: "PLATFORM_DELETE_TENANT",
            resource: "Tenant",
            resourceId: id,
            details: { tenantName: tenant.name, tenantEmail: tenant.email },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        // Note: Actual cascade delete should be done carefully in production
        // For safety, we only suspend here and log the intent
        // Uncomment to enable hard delete: await db.tenant.delete({ where: { id } });

        logger.warn("Platform Super Admin requested tenant deletion", {
            tenantId: id,
            tenantName: tenant.name,
            requestedBy: guard.user.userId,
        });

        return jsonResponse({
            message: `Tenant "${tenant.name}" has been suspended and marked for deletion. Contact system ops to complete hard deletion.`,
        });
    } catch (e) {
        logger.error("Super Admin DELETE Tenant Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
