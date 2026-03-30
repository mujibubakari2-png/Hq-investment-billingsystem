import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/dashboard - aggregate stats
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isAdmin = userPayload.role === "SUPER_ADMIN" || userPayload.role === "ADMIN";
        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";

        // Base filter for tenant isolation
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

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
            // New items:
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
            prisma.subscription.count({ where: { status: "ACTIVE", ...tenantFilter } }),
            prisma.subscription.count({ where: { status: "EXPIRED", ...tenantFilter } }),
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
            prisma.subscription.count({
                where: { status: "ACTIVE", onlineStatus: "ONLINE", ...tenantFilter },
            }),
            prisma.router.count({ where: tenantFilter }),
            prisma.router.count({ where: { status: "ONLINE", ...tenantFilter } }),
            isAdmin ? prisma.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: todayStart },
                    ...tenantFilter,
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            prisma.transaction.findMany({
                where: tenantFilter,
                take: 10,
                orderBy: { createdAt: "desc" },
                include: { client: { select: { username: true } }, tenant: true },
            }),
            prisma.subscription.findMany({
                where: tenantFilter,
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    client: { select: { username: true } },
                    package: { select: { name: true } },
                },
            }),
            isAdmin ? prisma.user.findMany({
                where: { lastLogin: { not: null }, ...tenantFilter },
                orderBy: { lastLogin: "desc" },
                take: 5,
                select: { username: true, role: true, email: true, lastLogin: true },
            }) : Promise.resolve([]),
            // new resolutions
            isAdmin ? prisma.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? prisma.transaction.aggregate({
                where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: monthStart }, ...tenantFilter },
                _sum: { amount: true }
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            prisma.voucher.count({ where: { createdAt: { gte: todayStart }, ...tenantFilter } }),
            prisma.voucher.count({ where: { status: "USED", usedAt: { gte: todayStart }, ...tenantFilter } }),
            prisma.voucher.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter } }),
            prisma.voucher.count({ where: { status: "USED", usedAt: { gte: monthStart }, ...tenantFilter } }),
            prisma.transaction.count({ where: { status: "COMPLETED", type: "VOUCHER", createdAt: { gte: todayStart }, ...tenantFilter } }),
            prisma.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: todayStart }, ...tenantFilter } }),
            prisma.transaction.count({ where: { status: "COMPLETED", type: "MOBILE", createdAt: { gte: monthStart }, ...tenantFilter } }),
            prisma.client.count({ where: { createdAt: { gte: monthStart }, ...tenantFilter } }),
            prisma.package.findMany({ where: tenantFilter, include: { _count: { select: { subscriptions: true } } } }),
            prisma.radAcct.count({ where: { acctstoptime: null, framedprotocol: { not: "PPP" }, ...tenantFilter } }),
            prisma.radAcct.count({ where: { acctstoptime: null, framedprotocol: "PPP", ...tenantFilter } }),
        ]);

        let revenueChartData: any[] = [];
        let revenueAnalytics = { daily: [], weekly: [], monthly: [], yearly: [] } as any;
        if (isAdmin) {
            try {
                // By day (last 30 days)
                const rawDaily = isSuperAdmin
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
                          AND "tenantId" = ${userPayload.tenantId}
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM-DD')
                        ORDER BY name ASC`;

                // By week (last 12 weeks)
                const rawWeekly = isSuperAdmin
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
                          AND "tenantId" = ${userPayload.tenantId}
                        GROUP BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt"))
                        ORDER BY DATE_TRUNC('week', timezone('Africa/Dar_es_Salaam', "createdAt")) ASC`;

                // By month (last 12 months)
                const rawMonthly = isSuperAdmin
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
                          AND "tenantId" = ${userPayload.tenantId}
                        GROUP BY TO_CHAR(timezone('Africa/Dar_es_Salaam', "createdAt"), 'YYYY-MM')
                        ORDER BY name ASC`;

                // By year
                const rawYearly = isSuperAdmin
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
                          AND "tenantId" = ${userPayload.tenantId}
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
            const rawGrowth = isSuperAdmin
                ? await prisma.$queryRaw<any[]>`
                    SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                    FROM clients
                    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                    GROUP BY TO_CHAR("createdAt", 'Mon')`
                : await prisma.$queryRaw<any[]>`
                    SELECT TO_CHAR("createdAt", 'Mon') as month, COUNT(*) as clients
                    FROM clients
                    WHERE "createdAt" >= NOW() - INTERVAL '6 months'
                      AND "tenantId" = ${userPayload.tenantId}
                    GROUP BY TO_CHAR("createdAt", 'Mon')`;
            subscriberGrowthData = rawGrowth.map(d => ({ month: d.month, clients: Number(d.clients) || 0 }));
        } catch (e) {
            console.error("Dashboard Raw SQL error (Growth):", e);
        }

        const loginActivities = recentLogins.map(u => ({
            id: `login-${u.username}-${u.lastLogin?.getTime()}`,
            title: u.role === 'SUPER_ADMIN' ? 'SuperAdmin' : u.role === 'ADMIN' ? 'Admin' : 'User',
            description: `${u.email || u.username} logged in via System`,
            date: u.lastLogin,
            status: 'Info',
            type: 'login'
        }));

        const transactionActivities = recentTransactions.map((t) => ({
            id: t.id,
            title: t.client.username,
            description: `${t.amount} TZS via ${t.method}`,
            date: t.createdAt,
            status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
            type: 'transaction'
        }));

        const systemActivities = [...loginActivities, ...transactionActivities]
            .sort((a, b) => {
                const timeA = a.date instanceof Date && !isNaN(a.date.getTime()) ? a.date.getTime() : 0;
                const timeB = b.date instanceof Date && !isNaN(b.date.getTime()) ? b.date.getTime() : 0;
                return timeB - timeA;
            })
            .slice(0, 5)
            .map(act => ({
                id: act.id,
                title: act.title,
                description: act.description,
                type: act.type,
                status: act.status,
                date: (act.date instanceof Date && !isNaN(act.date.getTime()))
                    ? act.date.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "Recent"
            }));

        // Mobile transactions metrics
        let mobileTransactionsStats: any[] = [];
        try {
            mobileTransactionsStats = await prisma.transaction.groupBy({
                by: ['status'],
                where: { type: 'MOBILE', ...tenantFilter },
                _count: { _all: true },
                _sum: { amount: true }
            } as any);
        } catch (e) { }

        const mobileTransactions = {
            totalCount: mobileTransactionsStats.reduce((acc, curr) => acc + curr._count._all, 0),
            totalRevenue: mobileTransactionsStats.filter(s => s.status === 'COMPLETED').reduce((acc, curr) => acc + (curr._sum.amount || 0), 0),
            paid: mobileTransactionsStats.find(s => s.status === 'COMPLETED')?._count._all || 0,
            unpaid: mobileTransactionsStats.find(s => s.status === 'PENDING')?._count._all || 0,
            failed: mobileTransactionsStats.find(s => s.status === 'FAILED')?._count._all || 0,
            canceled: mobileTransactionsStats.find(s => s.status === 'CANCELED')?._count._all || 0,
        };

        const response = {
            totalClients,
            newCustomersThisMonth, // newly added
            activeSubscribers,
            expiredSubscribers,
            totalRevenue: totalRevenue._sum.amount || 0,
            revenue: totalRevenue._sum.amount || 0, // Alias for TestSprite
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

            revenueAnalytics, // Fine-tuned addition
            revenueChartData,
            onlineUsers,
            hotspotOnlineUsers,
            pppoeOnlineUsers,
            active_users: onlineUsers, // Alias for TestSprite
            totalRouters,
            onlineRouters,
            router_status: `${onlineRouters}/${totalRouters}`, // Alias for TestSprite
            subscriberGrowthData,
            systemActivities,
            recentTransactions: isAdmin ? recentTransactions.map((t) => ({
                id: t.id,
                user: t.client.username,
                amount: t.amount,
                method: t.method,
                planType: t.planName || 'N/A', // approximate plan type/name
                status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
                date: (t.createdAt instanceof Date && !isNaN(t.createdAt.getTime())) ? t.createdAt.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recent",
                timeActiveSys: t.client ? "N/A" : "N/A", // This depends on mikrotik sync, setting N/A for display
            })) : [],
            recentSubscriptions: recentSubscriptions.map((s) => ({
                id: s.id,
                username: s.client.username,
                plan: s.package.name,
                status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
                expiresAt: (s.expiresAt instanceof Date && !isNaN(s.expiresAt.getTime())) ? s.expiresAt.toLocaleString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A",
            })),
        };

        return jsonResponse(response);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

