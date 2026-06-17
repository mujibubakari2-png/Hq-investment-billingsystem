import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
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
        const isAdmin = userPayload.role === "SUPER_ADMIN" || userPayload.role === "ADMIN";
        const isPlatformAdmin = isPlatformSuperAdmin(userPayload);

        const { searchParams: queryParams } = new URL(req.url);
        const targetTenantId = queryParams.get("tenantId");
        const routerId = queryParams.get("routerId");

        const cacheTenantKey = isPlatformAdmin ? (targetTenantId || 'all') : (userPayload.tenantId || 'self');
        const cacheKey = buildKey(userPayload.tenantId || 'global', 'dashboard', `${cacheTenantKey}:${routerId || 'all'}:${isAdmin ? 'admin' : 'user'}`);

        const cachedResponse = await withCache(cacheKey, TTL.DASHBOARD, async () => {
            const db = getTenantClient(userPayload);
            const tenantFilter: any = { tenantId: userPayload.tenantId };
            if (isPlatformAdmin && targetTenantId) {
                tenantFilter.tenantId = targetTenantId;
            }

            const routerFilter: any = {};
            if (routerId) {
                routerFilter.routerId = routerId;
            }

            const syncLockKey = `dashboard:radius:sync_lock:${userPayload.tenantId || 'global'}`;
            const lockAcquired = await redis.set(syncLockKey, "1", "PX", RADIUS_SYNC_INTERVAL_MS, "NX");
            const shouldSync = lockAcquired === "OK";

            if (shouldSync) {
                try {
                    const routers = await db.router.findMany({
                        where: { tenantId: { not: null } },
                        select: { host: true, tenantId: true, wgTunnelIp: true }
                    });

                    for (const router of routers) {
                        const possibleIps = [router.host, router.wgTunnelIp].filter(Boolean) as string[];
                        if (possibleIps.length > 0) {
                            await db.radAcct.updateMany({
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

            if (shouldSync) {
                try {
                    const activeRadiusSessions = await db.radAcct.findMany({
                        where: { acctstoptime: null, ...tenantFilter },
                        select: { username: true },
                        distinct: ["username"],
                    });

                    const onlineUsernames = new Set(activeRadiusSessions.map((s) => s.username));
                    const activeSubscriptions = await db.subscription.findMany({
                        where: { status: "ACTIVE", ...tenantFilter },
                        select: {
                            id: true,
                            onlineStatus: true,
                            client: { select: { username: true } },
                        },
                    });

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
                        await db.subscription.updateMany({
                            where: { id: { in: toSetOnline } },
                            data: { onlineStatus: "ONLINE" },
                        });
                    }
                    if (toSetOffline.length > 0) {
                        await db.subscription.updateMany({
                            where: { id: { in: toSetOffline } },
                            data: { onlineStatus: "OFFLINE" },
                        });
                    }
                } catch (e) {
                    console.error("[DASHBOARD RADIUS SYNC ERROR]: Failed to sync online status from RADIUS", e);
                }
            }

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
                db.transaction.findMany({
                    where: {
                        ...tenantFilter,
                        createdAt: { gte: todayStart },
                        status: "COMPLETED",
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
                isAdmin ? db.user.findMany({
                    where: {
                        lastLogin: {
                            not: null,
                            gte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                        },
                        ...tenantFilter,
                    },
                    orderBy: { lastLogin: "desc" },
                    take: 20,
                    select: { username: true, role: true, email: true, lastLogin: true, fullName: true },
                }) : Promise.resolve([]),
                isAdmin ? db.transaction.aggregate({
                    where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter },
                    _sum: { amount: true }
                }) : Promise.resolve({ _sum: { amount: 0 } }),
                isAdmin ? db.transaction.aggregate({
                    where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: monthStart }, ...tenantFilter },
                    _sum: { amount: true }
                }) : Promise.resolve({ _sum: { amount: 0 } }),
                db.voucher.count({ where: { createdAt: { gte: todayStart }, ...tenantFilter, ...routerFilter } }),
                db.voucher.count({ where: { status: "USED", usedAt: { gte: todayStart }, ...tenantFilter, ...routerFilter } }),
                db.voucher.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter, ...routerFilter } }),
                db.voucher.count({ where: { status: "USED", usedAt: { gte: monthStart }, ...tenantFilter, ...routerFilter } }),
                db.transaction.count({ where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter } }),
                db.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: todayStart }, ...tenantFilter } }),
                db.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: monthStart }, ...tenantFilter } }),
                db.client.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter } }),
                db.package.findMany({ where: { ...tenantFilter, ...routerFilter }, include: { _count: { select: { subscriptions: true } } } }),
                db.radAcct.count({ where: { acctstoptime: null, framedprotocol: { not: "PPP" }, ...tenantFilter } }),
                db.radAcct.count({ where: { acctstoptime: null, framedprotocol: "PPP", ...tenantFilter } }),
            ]);

            let revenueChartData: any[] = [];
            let revenueAnalytics = { daily: [], weekly: [], monthly: [], yearly: [] } as any;
            if (isAdmin) {
                try {
                    const rawDaily = isPlatformAdmin && !targetTenantId
                        ? await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '30 days'
                            GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                            ORDER BY name ASC`
                        : await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '30 days'
                              AND "tenantId" = ${tenantFilter.tenantId}
                            GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                            ORDER BY name ASC`;

                    const rawWeekly = isPlatformAdmin && !targetTenantId
                        ? await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")), 'YYYY-MM-DD') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 weeks'
                            GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                            ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`
                        : await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")), 'YYYY-MM-DD') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 weeks'
                              AND "tenantId" = ${tenantFilter.tenantId}
                            GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                            ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`;

                    const rawMonthly = isPlatformAdmin && !targetTenantId
                        ? await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 months'
                            GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                            ORDER BY name ASC`
                        : await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED' AND timezone('Africa/Dar_es_Salaam', "createdAt") >= timezone('Africa/Dar_es_Salaam', NOW()) - INTERVAL '12 months'
                              AND "tenantId" = ${tenantFilter.tenantId}
                            GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                            ORDER BY name ASC`;

                    const rawYearly = isPlatformAdmin && !targetTenantId
                        ? await db.$queryRaw<any[]>`
                            SELECT TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY') as name, SUM(amount) as value
                            FROM transactions
                            WHERE status = 'COMPLETED'
                            GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY')
                            ORDER BY name ASC`
                        : await db.$queryRaw<any[]>`
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
                    revenueChartData = revenueAnalytics.daily;
                } catch (e) {
                    console.error("Dashboard Raw SQL error (Revenue Analytics):", e);
                }
            }

            let subscriberGrowthData: any[] = [];
            try {
                const rawGrowth = isPlatformAdmin && !targetTenantId
                    ? await db.$queryRaw<any[]>`
                        SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                        FROM clients
                        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                        GROUP BY TO_CHAR("createdAt", 'Mon')`
                    : await db.$queryRaw<any[]>`
                        SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                        FROM clients
                        WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                          AND "tenantId" = ${tenantFilter.tenantId}
                        GROUP BY TO_CHAR("createdAt", 'Mon')`;
                subscriberGrowthData = rawGrowth.map(d => ({ month: d.month, clients: Number(d.clients) || 0 }));
            } catch (e) {
                console.error("Dashboard Raw SQL error (Growth):", e);
            }

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

            const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
            const systemActivities = [...loginActivities, ...transactionActivities]
                .filter(act => act.timestamp > fiveDaysAgo)
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
                canceled: mobileTransactionsStats.find(s => s.status === "CANCELED")?._count._all || 0,
            };

            return {
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
        });

        return jsonResponse(cachedResponse);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
