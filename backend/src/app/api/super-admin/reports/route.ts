import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET /api/super-admin/reports
 *
 * Platform-wide analytics and revenue reports.
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * All data is AGGREGATED at the platform level.
 * No individual tenant client/subscriber data is exposed.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const period = searchParams.get("period") || "12"; // months back
        const months = Math.min(24, Math.max(1, parseInt(period)));

        const now = new Date();
        const periodStart = new Date();
        periodStart.setMonth(periodStart.getMonth() - months);

        // ── 1. MRR by month (TenantPayment) ───────────────────────────────────
        const payments = await db.tenantPayment.findMany({
            where: { status: "COMPLETED", createdAt: { gte: periodStart } },
            select: { amount: true, createdAt: true },
            orderBy: { createdAt: "asc" },
        });

        const mrrByMonth: Record<string, number> = {};
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            mrrByMonth[key] = 0;
        }
        for (const p of payments) {
            const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
            if (key in mrrByMonth) mrrByMonth[key] += Number(p.amount);
        }

        const mrrTrend = Object.entries(mrrByMonth).map(([month, revenue]) => ({ month, revenue }));

        // ── 2. Tenant growth by month ──────────────────────────────────────────
        const tenants = await db.tenant.findMany({
            where: { createdAt: { gte: periodStart } },
            select: { createdAt: true, status: true },
            orderBy: { createdAt: "asc" },
        });

        const tenantsByMonth: Record<string, number> = {};
        for (const key of Object.keys(mrrByMonth)) tenantsByMonth[key] = 0;
        for (const t of tenants) {
            const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, "0")}`;
            if (key in tenantsByMonth) tenantsByMonth[key]++;
        }
        const tenantGrowth = Object.entries(tenantsByMonth).map(([month, count]) => ({ month, count }));

        // ── 3. Revenue by SaaS plan ────────────────────────────────────────────
        const invoicePlans = await db.tenantInvoice.groupBy({
            by: ["planId"],
            where: { status: "PAID", createdAt: { gte: periodStart } },
            _sum: { amount: true },
            _count: { id: true },
        });

        const plans = await db.saasPlan.findMany({
            where: { id: { in: invoicePlans.map((p) => p.planId) } },
            select: { id: true, name: true },
        });
        const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));

        const revenueByPlan = invoicePlans.map((g) => ({
            planId: g.planId,
            planName: planMap[g.planId] ?? "Unknown",
            revenue: Number(g._sum.amount ?? 0),
            invoiceCount: g._count.id,
        }));

        // ── 4. Tenant status breakdown ─────────────────────────────────────────
        const statusCounts = await db.tenant.groupBy({
            by: ["status"],
            _count: { id: true },
        });
        const statusBreakdown = statusCounts.map((s) => ({ status: s.status, count: s._count.id }));

        // ── 5. Summary KPIs ───────────────────────────────────────────────────
        const [totalRevenue, totalTenants, activeTenants, overdueInvoices, expiringSoon] = await Promise.all([
            db.tenantPayment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
            db.tenant.count(),
            db.tenant.count({ where: { status: "ACTIVE" } }),
            db.tenantInvoice.count({ where: { status: "PENDING", dueDate: { lt: now } } }),
            db.tenant.count({
                where: {
                    licenseExpiresAt: {
                        gte: now,
                        lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        const currentMonthRevenue = mrrTrend.at(-1)?.revenue ?? 0;
        const prevMonthRevenue = mrrTrend.at(-2)?.revenue ?? 0;
        const mrrGrowthPct = prevMonthRevenue > 0
            ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
            : 0;

        return jsonResponse({
            kpis: {
                totalRevenue: Number(totalRevenue._sum.amount ?? 0),
                totalTenants,
                activeTenants,
                churnRate: totalTenants > 0 ? Math.round(((totalTenants - activeTenants) / totalTenants) * 100) : 0,
                currentMonthRevenue,
                mrrGrowthPct,
                overdueInvoices,
                expiringSoon,
            },
            mrrTrend,
            tenantGrowth,
            revenueByPlan,
            statusBreakdown,
        });
    } catch (e) {
        logger.error("Super Admin GET Reports Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
