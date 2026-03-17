import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/dashboard - aggregate stats
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isAdmin = userPayload.role === "SUPER_ADMIN" || userPayload.role === "ADMIN";

        const [
            totalClients,
            activeSubscribers,
            expiredSubscribers,
            totalRevenue,
            monthlyRevenue,
            onlineUsers,
            totalRouters,
            onlineRouters,
            recentTransactions,
            recentSubscriptions,
            recentLogins,
        ] = await Promise.all([
            prisma.client.count(),
            prisma.subscription.count({ where: { status: "ACTIVE" } }),
            prisma.subscription.count({ where: { status: "EXPIRED" } }),
            isAdmin ? prisma.transaction.aggregate({
                where: { status: "COMPLETED" },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            isAdmin ? prisma.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                _sum: { amount: true },
            }) : Promise.resolve({ _sum: { amount: 0 } }),
            prisma.subscription.count({
                where: { status: "ACTIVE", onlineStatus: "ONLINE" },
            }),
            prisma.router.count(),
            prisma.router.count({ where: { status: "ONLINE" } }),
            prisma.transaction.findMany({
                take: 10,
                orderBy: { createdAt: "desc" },
                include: { client: { select: { username: true } } },
            }),
            prisma.subscription.findMany({
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    client: { select: { username: true } },
                    package: { select: { name: true } },
                },
            }),
            isAdmin ? prisma.user.findMany({
                where: { lastLogin: { not: null } },
                orderBy: { lastLogin: "desc" },
                take: 5,
                select: { username: true, role: true, email: true, lastLogin: true },
            }) : Promise.resolve([]),
        ]);

        const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());
        const revenueChartData: any[] = [];
        if (isAdmin) {
            const twentyDaysAgo = new Date();
            twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

            const dailyTransactions = await prisma.transaction.findMany({
                where: {
                    status: "COMPLETED",
                    createdAt: { gte: twentyDaysAgo },
                },
                select: { amount: true, createdAt: true },
            });

            const revenueByDay: Record<string, number> = {};
            dailyTransactions.forEach((t) => {
                if (isValidDate(t.createdAt)) {
                    const day = t.createdAt.getDate().toString().padStart(2, "0");
                    revenueByDay[day] = (revenueByDay[day] || 0) + t.amount;
                }
            });

            Object.entries(revenueByDay).forEach(([name, value]) => {
                revenueChartData.push({ name, value });
            });
        }

        // Subscriber growth (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyClients = await prisma.client.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true },
        });

        const growthByMonth: Record<string, number> = {};
        monthlyClients.forEach((c) => {
            if (isValidDate(c.createdAt)) {
                const month = c.createdAt.toLocaleString("en-US", { month: "short" });
                growthByMonth[month] = (growthByMonth[month] || 0) + 1;
            }
        });

        const subscriberGrowthData = Object.entries(growthByMonth).map(([month, clients]) => ({
            month,
            clients,
        }));

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
            .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
            .slice(0, 5)
            .map(act => ({
                id: act.id,
                title: act.title,
                description: act.description,
                type: act.type,
                status: act.status,
                date: isValidDate(act.date) ? act.date!.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A"
            }));

        return jsonResponse({
            totalClients,
            activeSubscribers,
            expiredSubscribers,
            totalRevenue: totalRevenue._sum.amount || 0,
            monthlyRevenue: monthlyRevenue._sum.amount || 0,
            onlineUsers,
            totalRouters,
            onlineRouters,
            revenueChartData,
            subscriberGrowthData,
            systemActivities,
            recentTransactions: isAdmin ? recentTransactions.map((t) => ({
                id: t.id,
                user: t.client.username,
                amount: t.amount,
                method: t.method,
                status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
                date: isValidDate(t.createdAt) ? t.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A",
            })) : [],
            recentSubscriptions: recentSubscriptions.map((s) => ({
                id: s.id,
                username: s.client.username,
                plan: s.package.name,
                status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
                expiresAt: isValidDate(s.expiresAt) ? s.expiresAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A",
            })),
        });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
