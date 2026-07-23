import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET /api/super-admin/overview
 *
 * Platform-level analytics dashboard data.
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * ALL data returned here is PLATFORM-LEVEL only:
 *   ✅ Tenant counts, statuses, license expiries
 *   ✅ Platform MRR (from TenantPayment records only)
 *   ✅ SaaS plan distribution
 *   ✅ License expiration alerts
 *
 *   ❌ NO tenant client data
 *   ❌ NO tenant revenue (internal transactions)
 *   ❌ NO vouchers, subscriptions, router details
 *   ❌ NO individual tenant operational data
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const [
            totalTenants,
            activeTenants,
            suspendedTenants,
            triallingTenants,
            pendingTenants,
            platformMRR,
            lastMonthMRR,
            expiringIn7Days,
            expiringIn30Days,
            expiredTenants,
            planDistribution,
            recentPayments,
            recentTenants,
        ] = await Promise.all([
            // Total tenants
            db.tenant.count(),

            // Active tenants
            db.tenant.count({ where: { status: "ACTIVE" } }),

            // Suspended tenants
            db.tenant.count({ where: { status: "SUSPENDED" } }),

            // Trialling tenants
            db.tenant.count({ where: { status: "TRIALLING" } }),

            // Pending approval
            db.tenant.count({ where: { status: "PENDING_APPROVAL" } }),

            // Platform MRR - current month license payments only
            db.tenantPayment.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: monthStart },
                },
                _sum: { amount: true },
            }),

            // Last month MRR for trend calculation
            db.tenantPayment.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: lastMonthStart, lt: monthStart },
                },
                _sum: { amount: true },
            }),

            // Tenants expiring in 7 days
            db.tenant.count({
                where: {
                    status: { in: ["ACTIVE", "TRIALLING"] },
                    licenseExpiresAt: { gte: now, lte: in7Days },
                },
            }),

            // Tenants expiring in 30 days
            db.tenant.count({
                where: {
                    status: { in: ["ACTIVE", "TRIALLING"] },
                    licenseExpiresAt: { gte: now, lte: in30Days },
                },
            }),

            // Tenants with expired licenses
            db.tenant.count({
                where: {
                    licenseExpiresAt: { lt: now },
                    status: { notIn: ["SUSPENDED"] },
                },
            }),

            // Plan distribution - count of tenants per plan
            db.saasPlan.findMany({
                select: {
                    id: true,
                    name: true,
                    price: true,
                    _count: { select: { tenants: true } },
                },
            }),

            // Recent license payments (last 10) - NO tenant operational data
            db.tenantPayment.findMany({
                orderBy: { createdAt: "desc" },
                take: 10,
                include: {
                    tenant: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            status: true,
                        },
                    },
                    invoice: {
                        select: {
                            invoiceNumber: true,
                            dueDate: true,
                        },
                    },
                },
            }),

            // Recently registered tenants (last 5)
            db.tenant.findMany({
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    status: true,
                    createdAt: true,
                    plan: { select: { name: true } },
                },
            }),
        ]);

        const currentMRR = Number(platformMRR._sum.amount || 0);
        const prevMRR = Number(lastMonthMRR._sum.amount || 0);
        const mrrTrend = prevMRR === 0 ? (currentMRR > 0 ? 100 : 0) : ((currentMRR - prevMRR) / prevMRR) * 100;

        return jsonResponse({
            overview: {
                totalTenants,
                activeTenants,
                suspendedTenants,
                triallingTenants,
                pendingTenants,
                expiredTenants,
            },
            revenue: {
                platformMRR: currentMRR,
                lastMonthMRR: prevMRR,
                mrrTrend: Number(mrrTrend.toFixed(2)),
            },
            alerts: {
                expiringIn7Days,
                expiringIn30Days,
            },
            planDistribution: planDistribution.map((p) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                tenantCount: p._count.tenants,
            })),
            recentPayments: recentPayments.map((p) => ({
                id: p.id,
                tenantId: p.tenantId,
                tenantName: p.tenant.name,
                tenantEmail: p.tenant.email,
                tenantStatus: p.tenant.status,
                amount: Number(p.amount),
                paymentMethod: p.paymentMethod,
                status: p.status,
                invoiceNumber: p.invoice?.invoiceNumber,
                createdAt: p.createdAt,
            })),
            recentTenants: recentTenants.map((t) => ({
                id: t.id,
                name: t.name,
                email: t.email,
                status: t.status,
                planName: t.plan?.name,
                createdAt: t.createdAt,
            })),
        });
    } catch (e) {
        logger.error("Super Admin Overview Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
