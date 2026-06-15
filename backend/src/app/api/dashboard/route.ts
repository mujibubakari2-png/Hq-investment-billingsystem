import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { withCache, invalidateNamespace, buildKey, TTL } from "@/lib/cache";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/tenant";
import { toISOSafe, toTimestampSafe, getStartOfTodayTZ, getStartOfMonthTZ } from "@/lib/dateUtils";
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
});
redis.on('error', (err) => {
    console.error('[Redis Error in dashboard route]:', err.message);
});

// Bug #5 FIX: Throttle RADIUS sync to at most once per 60 seconds across all PM2 instances
const RADIUS_SYNC_INTERVAL_MS = 60_000;

// GET /api/dashboard - aggregate stats
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "dashboard:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isAdmin = userPayload.role === "SUPER_ADMIN" || userPayload.role === "ADMIN";
        const isPlatformAdmin = isPlatformSuperAdmin(userPayload);

        // Base filter for tenant isolation
        const tenantFilter = { tenantId: userPayload.tenantId };

        // Super Admin can override tenant filter to see specific tenant dashboard via query param
        const { searchParams: queryParams } = new URL(req.url);
        const targetTenantId = queryParams.get("tenantId");
        const routerId = queryParams.get("routerId");

        if (isPlatformAdmin && targetTenantId) {
            tenantFilter.tenantId = targetTenantId;
        }

        // Router filter for stats (clients, subscriptions, transactions)
        const routerFilter: any = {};
        if (routerId) {
            routerFilter.routerId = routerId;
        }

        // ── RADIUS Accounting Cleanup (Multi-tenancy fix) ──
        // Bug #5 FIX: Throttle sync operations to run at most once per 60 seconds
        // using a Redis mutex to prevent simultaneous syncs across PM2 processes.
        const syncLockKey = `dashboard:radius:sync_lock:${userPayload.tenantId || 'global'}`;
        const lockAcquired = await redis.set(syncLockKey, "1", "PX", RADIUS_SYNC_INTERVAL_MS, "NX");
        const shouldSync = lockAcquired === "OK";

        if (shouldSync) {

            // Ensure all radacct records have a tenantId by mapping nasipaddress to Router table.
            try {
                const routers = await prisma.router.findMany({
                    where: { tenantId: { not: null } },
                    select: { host: true, tenantId: true, wgTunnelIp: true }
                });

                for (const router of routers) {
                    const possibleIps = [router.host, router.wgTunnelIp].filter(Boolean) as string[];
                    if (possibleIps.length > 0) {
                        await prisma.radAcct.updateMany({
                            where: {
                                nasipaddress: { in: possibleIps },
                                tenantId: null
                            },
                            data: { tenantId: router.tenantId }
                        });
                    }
                }
            } catch (e) {
                console.error("[DASHBOARD SYNC ERROR]: Failed to map RADIUS sessions to tenants", e);
            }
        }

        // ── RADIUS Online Status Sync ──
        // Sync subscription onlineStatus from live RADIUS accounting sessions.
        // Users with an open radacct record (acctstoptime IS NULL) are ONLINE.
        // Bug #5 FIX: Also throttled to avoid heavy DB writes on every 30s refresh.
        if (shouldSync) {
            try {
                const activeRadiusSessions = await prisma.radAcct.findMany({
                    where: { acctstoptime: null, ...tenantFilter },
                    select: { username: true },
                    distinct: ["username"],
                });

                const onlineUsernames = new Set(activeRadiusSessions.map((s) => s.username));

                // Get all active subscriptions with their client usernames
                const activeSubscriptions = await prisma.subscription.findMany({
                    where: { status: "ACTIVE", ...tenantFilter },
                    select: {
                        id: true,
                        onlineStatus: true,
                        client: { select: { username: true } },
                    },
                });

                // Batch update online status based on RADIUS sessions
                const toSetOnline: string[] = [];
                const toSetOffline: string[] = [];

                for (const sub of activeSubscriptions as any[]) {
                    const username = sub.client?.username;
                    if (!username) continue;
                    if (onlineUsernames.has(username) && sub.onlineStatus !== "ONLINE") {
                        toSetOnline.push(sub.id);
                    } else if (!onlineUsernames.has(username) && sub.onlineStatus !== "OFFLINE") {
                        toSetOffline.push(sub.id);
                    }
                }

                if (toSetOnline.length > 0) {
                    await prisma.subscription.updateMany({
                        where: { id: { in: toSetOnline } },
                        data: { onlineStatus: "ONLINE" },
                    });
                }
                if (toSetOffline.length > 0) {
                    await prisma.subscription.updateMany({
                        where: { id: { in: toSetOffline } },
                        data: { onlineStatus: "OFFLINE" },
                    });
                }
            } catch (e) {
                console.error("[DASHBOARD RADIUS SYNC ERROR]: Failed to sync online status from RADIUS", e);
            }
        }

        // Fixed: Use timezone-aware boundaries (Africa/Dar_es_Salaam) to match frontend display
        const todayStart = new Date(getStartOfTodayTZ());
        const monthStart = new Date(getStartOfMonthTZ());

        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);

        const [
            totalClients,
            activeSubscribers,
            expiredSubscribers,
            totalRevenue,
            monthlyRevenue,
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
            vouchersGeneratedToday,
            vouchersUsedToday,
            vouchersGeneratedMonth,
            vouchersUsedMonth,
            todayRechargesVoucher,
            todayRechargesMobile,
            monthlyRechargesMobile,
            newCustomersThisMonth,
            packagesData,
            hotspotOnlineUsers,
            pppoeOnlineUsers,
        ] = await Promise.all([
            prisma.client.count({ where: tenantFilter }),
            prisma.subscription.count({ where: { status: "ACTIVE", ...tenantFilter, ...routerFilter } }),
            prisma.subscription.count({ where: { status: "EXPIRED", ...tenantFilter, ...routerFilter } }),
            isAdmin ? prisma.transaction.aggregate({
                where: { status: "COMPLETED", ...tenantFilter },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? prisma.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: monthStart },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            // Online users count from subscriptions (already synced from RADIUS above)
            prisma.subscription.count({
                where: { status: "ACTIVE", onlineStatus: "ONLINE", ...tenantFilter, ...routerFilter },
            }),
            prisma.router.count({ where: { ...tenantFilter, ...(routerId ? { id: routerId } : {}) } }),
            prisma.router.count({ where: { status: "ONLINE", ...tenantFilter, ...(routerId ? { id: routerId } : {}) } }),
            isAdmin ? prisma.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: todayStart },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            // Recent transactions - include today only, with payment channel info
            prisma.transaction.findMany({
                where: {
                    ...tenantFilter,
                    createdAt: { gte: todayStart },
                    status: "COMPLETED",
                },
                take: 10,
                orderBy: { createdAt: "desc" },
                include: { client: { select: { username: true } } },
            }),
            prisma.subscription.findMany({
                where: { ...tenantFilter, ...routerFilter },
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    client: { select: { username: true } },
                    package: { select: { name: true } },
                },
            }),
            // Tenant login activity for system activity (last 5 days)
            isAdmin ? prisma.user.findMany({
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
            isAdmin ? prisma.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? prisma.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: monthStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            prisma.voucher.count({ where: { createdAt: { gte: todayStart }, ...tenantFilter, ...routerFilter } }),
            prisma.voucher.count({ where: { status: "USED", usedAt: { gte: todayStart }, ...tenantFilter, ...routerFilter } }),
            prisma.voucher.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter, ...routerFilter } }),
            prisma.voucher.count({ where: { status: "USED", usedAt: { gte: monthStart }, ...tenantFilter, ...routerFilter } }),
            prisma.transaction.count({ where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter } }),
            prisma.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: todayStart }, ...tenantFilter } }),
            prisma.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: monthStart }, ...tenantFilter } }),
            prisma.client.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter } }),
            prisma.package.findMany({ where: { ...tenantFilter, ...routerFilter }, include: { _count: { select: { subscriptions: true } } } }),
            // RADIUS-based hotspot online count (acctstoptime IS NULL, not PPP)
            prisma.radAcct.count({ where: { acctstoptime: null, framedprotocol: { not: "PPP" }, ...tenantFilter } }),
            // RADIUS-based PPPoE online count (acctstoptime IS NULL, framedprotocol = PPP)
            prisma.radAcct.count({ where: { acctstoptime: null, framedprotocol: "PPP", ...tenantFilter } }),
        ]);

        let revenueChartData: any[] = [];
        let revenueAnalytics = { daily: [], weekly: [], monthly: [], yearly: [] } as any;
        if (isAdmin) {
            try {
                // By day (last 30 days)
                const rawDaily = isPlatformAdmin && !targetTenantId
                    ? await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '30 days'
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                        ORDER BY name ASC`
                    : await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '30 days'
                          AND "tenantId" = ${tenantFilter.tenantId}
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                        ORDER BY name ASC`;

                // By week (last 12 weeks)
                const rawWeekly = isPlatformAdmin && !targetTenantId
                    ? await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")), 'YYYY-MM-DD') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 weeks'
                        GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                        ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`
                    : await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")), 'YYYY-MM-DD') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 weeks'
                          AND "tenantId" = ${tenantFilter.tenantId}
                        GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                        ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`;

                // By month (last 12 months)
                const rawMonthly = isPlatformAdmin && !targetTenantId
                    ? await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 months'
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                        ORDER BY name ASC`
                    : await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 months'
                          AND "tenantId" = ${tenantFilter.tenantId}
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                        ORDER BY name ASC`;

                // By year
                const rawYearly = isPlatformAdmin && !targetTenantId
                    ? await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED'
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY')
                        ORDER BY name ASC`
                    : await prisma.$queryRaw<any[]>`
                        SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY') as name, SUM(amount) as value
                        FROM transactions
                        WHERE status = 'COMPLETED'
                          AND "tenantId" = ${tenantFilter.tenantId}
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY')
                        ORDER BY name ASC`;

                revenueAnalytics.daily = rawDaily.map(d => ({ name: d.name, value: Number(d.value) || 0 }));
                revenueAnalytics.weekly = rawWeekly.map(d => ({ name: d.name, value: Number(d.value) || 0 }));
                revenueAnalytics.monthly = rawMonthly.map(d => ({ name: d.name, value: Number(d.value) || 0 }));
                revenueAnalytics.yearly = rawYearly.map(d => ({ name: d.name, value: Number(d.value) || 0 }));

                // Keep revenueChartData for backward compatibility (defaults to daily)
                revenueChartData = revenueAnalytics.daily;
            } catch (e) {
                console.error("Dashboard Raw SQL error (Revenue Analytics):", e);
            }
        }

        // Subscriber growth (last 6 months)
        let subscriberGrowthData: any[] = [];
        try {
            const rawGrowth = isPlatformAdmin && !targetTenantId
                ? await prisma.$queryRaw<any[]>`
                    SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                    FROM clients
                    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                    GROUP BY TO_CHAR("createdAt", 'Mon')`
                : await prisma.$queryRaw<any[]>`
                    SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                    FROM clients
                    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                      AND "tenantId" = ${tenantFilter.tenantId}
                    GROUP BY TO_CHAR("createdAt", 'Mon')`;
            subscriberGrowthData = rawGrowth.map(d => ({ month: d.month, clients: Number(d.clients) || 0 }));
        } catch (e) {
            console.error("Dashboard Raw SQL error (Growth):", e);
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
            return {
                id: t.id,
                title: `${transactionType} Transaction`,
                description: `${t.client.username} paid ${t.amount.toLocaleString()} TZS via ${paymentChannel}`,
                date: toISOSafe(t.createdAt),
                timestamp: toTimestampSafe(t.createdAt),
                status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
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
            mobileTransactionsStats = await prisma.transaction.groupBy({
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
            canceled: mobileTransactionsStats.find(s => s.status === "CANCELED")?._count._all || 0,
        };

        const response = {
            totalClients,
            newCustomersThisMonth,
            activeSubscribers,
            expiredSubscribers,
            totalRevenue: totalRevenue._sum.amount || 0,
            revenue: totalRevenue._sum.amount || 0,
            todayRevenue: todayRevenue._sum.amount || 0,
            monthlyRevenue: monthlyRevenue._sum.amount || 0,

            todayVoucherRev: todayVoucherRev._sum.amount || 0,
            monthlyVoucherRev: monthlyVoucherRev._sum.amount || 0,
            vouchersGeneratedToday,
            vouchersUsedToday,
            vouchersGeneratedMonth,
            vouchersUsedMonth,
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

        return jsonResponse(response);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
