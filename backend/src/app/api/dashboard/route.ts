import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/dashboard - aggregate stats
export async function GET() {
    try {
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
        ] = await Promise.all([
            prisma.client.count(),
            prisma.subscription.count({ where: { status: "ACTIVE" } }),
            prisma.subscription.count({ where: { status: "EXPIRED" } }),
            prisma.transaction.aggregate({
                where: { status: "COMPLETED" },
                _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
                where: {
                    status: "COMPLETED",
                    createdAt: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                _sum: { amount: true },
            }),
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
        ]);

        // Revenue by day for chart (last 20 days)
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
            const day = t.createdAt.getDate().toString().padStart(2, "0");
            revenueByDay[day] = (revenueByDay[day] || 0) + t.amount;
        });

        const revenueChartData = Object.entries(revenueByDay).map(([name, value]) => ({
            name,
            value,
        }));

        // Subscriber growth (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyClients = await prisma.client.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true },
        });

        const growthByMonth: Record<string, number> = {};
        monthlyClients.forEach((c) => {
            const month = c.createdAt.toLocaleString("en-US", { month: "short" });
            growthByMonth[month] = (growthByMonth[month] || 0) + 1;
        });

        const subscriberGrowthData = Object.entries(growthByMonth).map(([month, clients]) => ({
            month,
            clients,
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
            recentTransactions: recentTransactions.map((t) => ({
                id: t.id,
                user: t.client.username,
                amount: t.amount,
                method: t.method,
                status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
                date: t.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            })),
            recentSubscriptions: recentSubscriptions.map((s) => ({
                id: s.id,
                username: s.client.username,
                plan: s.package.name,
                status: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
                expiresAt: s.expiresAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            })),
        });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
