import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { withCache, invalidateNamespace, buildKey, TTL, getRedisClient } from "@/lib/cache";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/tenant";
import { toISOSafe, toTimestampSafe, getStartOfTodayTZ, getStartOfMonthTZ } from "@/lib/dateUtils";
import logger from "@/lib/logger";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

// HIGH-R-003 FIX: RADIUS sync removed from GET /api/dashboard.
// It now runs as a BullMQ repeatable job (src/jobs/radiusSyncWorker.ts)
// every 60 s, independent of page loads. This eliminates write-amplification
// where every 30-second dashboard refresh triggered subscription.updateMany
// for every active tenant.

// GET /api/dashboard - aggregate stats
export async function GET(req: NextRequest) {
    // Capture context early so it's available in catch block
    let _userId: string | undefined;
    let _tenantId: string | null | undefined;
    try {
        const guard = requirePermission(req, "dashboard:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        _userId = userPayload.userId;
        _tenantId = userPayload.tenantId;
        const db = getTenantClient(userPayload);
        const globalDb = getTenantClient(null);

        const isAdmin = userPayload.role === "SUPER_ADMIN" || userPayload.role === "ADMIN";
        const isPlatformAdmin = isPlatformSuperAdmin(userPayload);
        const { searchParams: queryParams } = new URL(req.url);
        const targetTenantId = queryParams.get("tenantId");
        const routerId = queryParams.get("routerId");

        // Base filter for tenant isolation
        let tenantFilter: any = {};
        if (isPlatformAdmin) {
            if (targetTenantId) {
                tenantFilter.tenantId = targetTenantId;
                // HIGH-MT-002 FIX: Audit platform admin cross-tenant dashboard reads.
                // Previously these were completely invisible in audit logs.
                writeAuditLog({
                    tenantId: targetTenantId,
                    userId: userPayload.userId,
                    action: 'CROSS_TENANT_DASHBOARD_READ',
                    resource: 'Dashboard',
                    details: { targetTenantId, routerId: routerId ?? undefined },
                    ipAddress: getIpFromRequest(req),
                }).catch(() => { /* non-blocking */ });
            }
        } else {
            tenantFilter.tenantId = userPayload.tenantId;
        }

        // Router filter for stats (clients, subscriptions, transactions)
        const routerFilter: any = {};
        if (routerId) {
            routerFilter.routerId = routerId;
        }

        const statsDb = isPlatformAdmin && !targetTenantId ? globalDb : db;

        // ── Dashboard Cache (HIGH-S-001) ───────────────────────────────────────
        // All 28+ queries are wrapped in a single withCache() call.
        // Key is scoped to tenantId + optional routerId so different router
        // filters produce independent cache entries.
        // TTL = 60 s — tolerable staleness for a monitoring dashboard.
        // The RADIUS sync worker (radiusSyncWorker.ts) calls invalidateNamespace()
        // after every sync, so the cache self-invalidates within seconds of a
        // status change rather than waiting the full 60-second TTL.
        const cacheKey = buildKey(
            userPayload.tenantId ?? (targetTenantId || null),
            'dashboard',
            `stats:${routerId || 'all'}`,
        );

        const response = await withCache(
            cacheKey,
            TTL.DASHBOARD, // 60 s
            async () => {
        // HIGH-S-001: All 28 queries run inside the withCache fetcher.
        // On cache hit this entire block is skipped — response time drops to <5ms.

        // Date boundaries (computed fresh inside the fetcher on every cache miss)
        const todayStart    = new Date(getStartOfTodayTZ());
        const monthStart    = new Date(getStartOfMonthTZ());
        const lastMonthStart = new Date(monthStart);
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
        const lastMonthEnd = new Date(monthStart);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);

        const [
            totalClients,
            activeSubscribers,
            expiredSubscribers,
            totalRevenue,
            monthlyRevenue,
            lastMonthRevenue,
            onlineUsers,
            totalRouters,
            onlineRouters,
            todayRevenue,
            recentTransactions,
            recentSubscriptions,
            recentLogins,
            // Voucher stats
            todayVoucherRev,
            monthlyVoucherRev,
            lastMonthVoucherRev,
            vouchersUsedToday,
            vouchersUsedMonth,
            todayRechargesVoucher,
            todayRechargesMobile,
            monthlyRechargesMobile,
            newCustomersThisMonth,
            packagesData,
            hotspotOnlineUsers,
            pppoeOnlineUsers,
            // Yesterday comparisons (for today-vs-yesterday trend badges)
            yesterdayRevenue,
            yesterdayVoucherRev,
        ] = await Promise.all([
            db.client.count({ where: tenantFilter }),
            db.subscription.count({ where: { status: "ACTIVE", ...tenantFilter, ...routerFilter } }),
            db.subscription.count({ where: { status: "EXPIRED", ...tenantFilter, ...routerFilter } }),
            isAdmin ? db.transaction.aggregate({
                where: { status: "COMPLETED", ...tenantFilter },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? db.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: monthStart },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? db.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            // Online users count from subscriptions (already synced from RADIUS above)
            db.subscription.count({
                where: { status: "ACTIVE", onlineStatus: "ONLINE", ...tenantFilter, ...routerFilter },
            }),
            db.router.count({ where: { ...tenantFilter, ...(routerId ? { id: routerId } : {}) } }),
            db.router.count({ where: { status: "ONLINE", ...tenantFilter, ...(routerId ? { id: routerId } : {}) } }),
            isAdmin ? db.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: todayStart },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            // Recent transactions - include today only, with payment channel info
            db.transaction.findMany({
                where: {
                    ...tenantFilter,
                    createdAt: { gte: todayStart },
                    status: { in: ["COMPLETED", "PENDING", "FAILED"] },
                    type: { in: ["MOBILE", "VOUCHER"] },
                },
                take: 10,
                orderBy: { createdAt: "desc" },
                include: { client: { select: { username: true } } },
            }),
            db.subscription.findMany({
                where: { ...tenantFilter, ...routerFilter },
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    client: { select: { username: true } },
                    package: { select: { name: true } },
                },
            }),
            // Tenant login activity for system activity (last 5 days)
            isAdmin ? db.user.findMany({
                where: {
                    lastLogin: {
                        not: null,
                        gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Last 5 days only
                    },
                    ...tenantFilter,
                },
                orderBy: { lastLogin: "desc" },
                take: 20, // More entries so we can show varied activity
                select: { username: true, role: true, email: true, lastLogin: true, fullName: true },
            }) : Promise.resolve([]),
            // Voucher stats
            isAdmin ? db.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? db.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: monthStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? db.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: lastMonthStart, lt: lastMonthEnd }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            db.voucher.count({ where: { status: "USED", usedAt: { gte: todayStart }, ...tenantFilter, ...routerFilter } }),
            db.voucher.count({ where: { status: "USED", usedAt: { gte: monthStart }, ...tenantFilter, ...routerFilter } }),
            db.transaction.count({ where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter } }),
            db.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: todayStart }, ...tenantFilter } }),
            db.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: monthStart }, ...tenantFilter } }),
            db.client.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter } }),
            db.package.findMany({ where: { ...tenantFilter, ...routerFilter }, include: { _count: { select: { subscriptions: true } } } }),
            // RADIUS-based hotspot online count (acctstoptime IS NULL, not PPP)
            db.radAcct.count({ where: { acctstoptime: null, framedprotocol: { not: "PPP" }, ...tenantFilter } }),
            // RADIUS-based PPPoE online count (acctstoptime IS NULL, framedprotocol = PPP)
            db.radAcct.count({ where: { acctstoptime: null, framedprotocol: "PPP", ...tenantFilter } }),
            isAdmin ? db.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: yesterdayStart, lt: todayStart },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? db.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: yesterdayStart, lt: todayStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
        ]);

        // Calculate analytics trends
        // NOTE: when the current value drops to 0 while the previous value was > 0, the
        // real percentage change IS -100% (a full drop) — that is correct and expected,
        // not a bug. The only bug case to guard against is 0 -> 0 (no data either period),
        // which should read as "0% / no change" rather than leaking a stray value.
        const currRev = monthlyRevenue._sum.amount || 0;
        const prevRev = lastMonthRevenue._sum.amount || 0;
        const monthlyRevenueTrend = prevRev === 0 ? (currRev > 0 ? 100 : 0) : ((currRev - prevRev) / prevRev) * 100;

        const currVoucherRev = monthlyVoucherRev._sum.amount || 0;
        const prevVoucherRev = lastMonthVoucherRev._sum.amount || 0;
        const monthlyVoucherRevTrend = prevVoucherRev === 0 ? (currVoucherRev > 0 ? 100 : 0) : ((currVoucherRev - prevVoucherRev) / prevVoucherRev) * 100;

        // Today's Revenue vs Yesterday
        const currTodayRev = todayRevenue._sum.amount || 0;
        const prevTodayRev = yesterdayRevenue._sum.amount || 0;
        const todayRevenueTrend = prevTodayRev === 0 ? (currTodayRev > 0 ? 100 : 0) : ((currTodayRev - prevTodayRev) / prevTodayRev) * 100;

        // Today's Voucher Revenue vs Yesterday
        const currTodayVoucherRev = todayVoucherRev._sum.amount || 0;
        const prevTodayVoucherRev = yesterdayVoucherRev._sum.amount || 0;
        const todayVoucherRevTrend = prevTodayVoucherRev === 0 ? (currTodayVoucherRev > 0 ? 100 : 0) : ((currTodayVoucherRev - prevTodayVoucherRev) / prevTodayVoucherRev) * 100;

        let revenueChartData: any[] = [];
        let revenueAnalytics = { daily: [], weekly: [], monthly: [], yearly: [] } as any;
        if (isAdmin) {
            try {
                // By day (last 30 days)
                const rawDaily = isPlatformAdmin && !targetTenantId
                    ? await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '30 days'
                                                GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                                                ORDER BY name ASC`
                    : await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '30 days'
                                                    AND "tenantId" = ${tenantFilter.tenantId ?? null}
                                                GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                                                ORDER BY name ASC`;

                // By week (last 12 weeks)
                const rawWeekly = isPlatformAdmin && !targetTenantId
                    ? await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")), 'YYYY-MM-DD') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 weeks'
                                                GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                                                ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`
                    : await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")), 'YYYY-MM-DD') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 weeks'
                                                    AND "tenantId" = ${tenantFilter.tenantId ?? null}
                                                GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                                                ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`;

                // By month (last 12 months)
                const rawMonthly = isPlatformAdmin && !targetTenantId
                    ? await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 months'
                                                GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                                                ORDER BY name ASC`
                    : await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 months'
                                                    AND "tenantId" = ${tenantFilter.tenantId ?? null}
                                                GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                                                ORDER BY name ASC`;

                // By year
                const rawYearly = isPlatformAdmin && !targetTenantId
                    ? await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED'
                                                GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY')
                                                ORDER BY name ASC`
                    : await statsDb.$queryRaw<any[]>`
                                                SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY') as name, SUM(amount) as value
                                                FROM transactions
                                                WHERE status = 'COMPLETED'
                                                    AND "tenantId" = ${tenantFilter.tenantId ?? null}
                                                GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY')
                                                ORDER BY name ASC`;

                revenueAnalytics.daily = rawDaily.map(d => ({ name: d.name, value: Number(d.value) || 0 }));
                revenueAnalytics.weekly = rawWeekly.map(d => ({ name: d.name, value: Number(d.value) || 0 }));
                revenueAnalytics.monthly = rawMonthly.map(d => ({ name: d.name, value: Number(d.value) || 0 }));
                revenueAnalytics.yearly = rawYearly.map(d => ({ name: d.name, value: Number(d.value) || 0 }));

                // Keep revenueChartData for backward compatibility (defaults to daily)
                revenueChartData = revenueAnalytics.daily;
            } catch (e) {
                logger.error("Dashboard Raw SQL error (Revenue Analytics)", {
                    endpoint: "GET /api/dashboard",
                    userId: _userId,
                    tenantId: _tenantId,
                    error: e instanceof Error ? e.message : String(e),
                    stack: e instanceof Error ? e.stack : undefined,
                    query: "revenue_analytics",
                });
            }
        }

        // Subscriber growth (last 6 months)
        let subscriberGrowthData: any[] = [];
        try {
            const rawGrowth = isPlatformAdmin && !targetTenantId
                ? await statsDb.$queryRaw<any[]>`
                    SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                    FROM clients
                    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                    GROUP BY TO_CHAR("createdAt", 'Mon')`
                : await statsDb.$queryRaw<any[]>`
                    SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                    FROM clients
                    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                      AND "tenantId" = ${tenantFilter.tenantId ?? null}
                    GROUP BY TO_CHAR("createdAt", 'Mon')`;
            subscriberGrowthData = rawGrowth.map(d => ({ month: d.month, clients: Number(d.clients) || 0 }));
        } catch (e) {
            logger.error("Dashboard Raw SQL error (Subscriber Growth)", {
                endpoint: "GET /api/dashboard",
                userId: _userId,
                tenantId: _tenantId,
                error: e instanceof Error ? e.message : String(e),
                stack: e instanceof Error ? e.stack : undefined,
                query: "subscriber_growth",
            });
        }

        // Build system activities from tenant logins within last 5 days
        // Each login event is a separate activity entry
        const loginActivities = recentLogins.map(u => {
            const roleLabel = u.role === "SUPER_ADMIN" ? "Super Admin" : u.role === "ADMIN" ? "Admin" : "Agent";
            const displayName = (u as any).fullName || u.username;
            return {
                id: `login-${u.username}-${toTimestampSafe(u.lastLogin)}`,
                title: `${roleLabel} Login`,
                description: `${displayName} (${u.email || u.username}) signed in to the system`,
                date: toISOSafe(u.lastLogin),
                timestamp: toTimestampSafe(u.lastLogin),
                status: "Info",
                type: "login",
            };
        });

        // Build transaction activities from today's transactions (already filtered to today)
        const transactionActivities = recentTransactions.map((t) => {
            const transactionType = t.type === "VOUCHER" ? "Voucher" : t.type === "MOBILE" ? "Payment" : "Manual";
            const paymentChannel = t.method || "Unknown";
            const statusLabel = t.status.charAt(0) + t.status.slice(1).toLowerCase();
            const action = t.status === "COMPLETED" ? "paid" : t.status === "FAILED" ? "failed to pay" : "started payment of";
            return {
                id: t.id,
                title: `${transactionType} Transaction`,
                description: `${t.client.username} ${action} ${t.amount.toLocaleString()} TZS via ${paymentChannel}`,
                date: toISOSafe(t.createdAt),
                timestamp: toTimestampSafe(t.createdAt),
                status: statusLabel,
                type: "transaction",
            };
        });

        // Merge and sort, keep last 5 days, limit to 10 for display
        const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
        const systemActivities = [...loginActivities, ...transactionActivities]
            .filter(act => act.timestamp > fiveDaysAgo) // Only last 5 days
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .map(act => ({
                id: act.id,
                title: act.title,
                description: act.description,
                type: act.type,
                status: act.status,
                date: act.date || null,
            }));

        // Mobile transactions metrics
        let mobileTransactionsStats: any[] = [];
        try {
            mobileTransactionsStats = await db.transaction.groupBy({
                by: ["status"],
                where: { type: "MOBILE", ...tenantFilter },
                _count: { _all: true },
                _sum: { amount: true }
            } as any);
        } catch (e) { }

        const mobileTransactions = {
            totalCount: mobileTransactionsStats.reduce((acc, curr) => acc + curr._count._all, 0),
            totalRevenue: mobileTransactionsStats.filter(s => s.status === "COMPLETED").reduce((acc, curr) => acc + (curr._sum.amount || 0), 0),
            paid: mobileTransactionsStats.find(s => s.status === "COMPLETED")?._count._all || 0,
            unpaid: mobileTransactionsStats.find(s => s.status === "PENDING")?._count._all || 0,
            failed: mobileTransactionsStats.find(s => s.status === "FAILED")?._count._all || 0,
            canceled: 0, // Note: TransactionStatus enum has no CANCELED variant; use FAILED for failed payments
        };

        const payload = {
            totalClients,
            newCustomersThisMonth,
            activeSubscribers,
            expiredSubscribers,
            totalRevenue: totalRevenue._sum.amount || 0,
            revenue: totalRevenue._sum.amount || 0,
            todayRevenue: todayRevenue._sum.amount || 0,
            todayRevenueTrend, // Added trend (vs yesterday)
            monthlyRevenue: monthlyRevenue._sum.amount || 0,
            monthlyRevenueTrend, // Added trend

            todayVoucherRev: todayVoucherRev._sum.amount || 0,
            todayVoucherRevTrend, // Added trend (vs yesterday)
            monthlyVoucherRev: monthlyVoucherRev._sum.amount || 0,
            monthlyVoucherRevTrend, // Added trend
            vouchersUsedToday,
            vouchersUsedMonth,
            // Removed vouchersGeneratedToday / vouchersGeneratedMonth as requested
            todayRechargesVoucher,
            todayRechargesMobile,
            monthlyRechargesMobile,
            serviceUtilization: packagesData.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                activeUsersCount: p._count.subscriptions
            })),
            mobileTransactions,

            revenueAnalytics,
            revenueChartData,
            onlineUsers,
            hotspotOnlineUsers,
            pppoeOnlineUsers,
            active_users: onlineUsers,
            totalRouters,
            onlineRouters,
            router_status: `${onlineRouters}/${totalRouters}`,
            subscriberGrowthData,
            systemActivities,
            // Recent transactions for today only, enriched with payment channel + type
            recentTransactions: isAdmin ? recentTransactions.map((t) => {
                const isVoucher = t.type === "VOUCHER";
                const channelLabel = isVoucher ? "Voucher" : (t.method || "N/A");
                return {
                    id: t.id,
                    user: t.client.username,
                    amount: t.amount,
                    method: channelLabel,
                    transactionType: t.type || "MOBILE",
                    isVoucher,
                    paymentChannel: t.method || "N/A",
                    planType: t.planName || "N/A",
                    status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
                    reference: t.providerRef || t.reference || null,
                    transactionId: t.providerRef || t.reference || null,
                    providerRef: t.providerRef || null,
                    date: toISOSafe(t.createdAt),
                    timeActiveSys: "N/A",
                };
            }) : [],
            recentSubscriptions: recentSubscriptions.map((s) => ({
                id: s.id,
                username: s.client.username,
                plan: s.package.name,
                status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
                expiresAt: toISOSafe(s.expiresAt),
            })),
        };

        // Return the payload from inside the withCache fetcher
        return payload;
        }); // end withCache — result assigned to `response`

        return jsonResponse(response);
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.error('Dashboard route failed', {
            endpoint: 'GET /api/dashboard',
            userId: _userId,
            tenantId: _tenantId,
            error: err.message,
            stack: err.stack,
        });
        return errorResponse(
            `Internal server error`,
            500,
            "DASHBOARD_INTERNAL_ERROR",
            err.message
        );
    }
}
