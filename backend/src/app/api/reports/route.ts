import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { NextRequest } from "next/server";

// GET /api/reports
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const period = searchParams.get("period") || "month"; // day, week, month, year
        const type = searchParams.get("type") || "revenue"; // revenue, clients, subscriptions

        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case "day":
                startDate.setDate(now.getDate() - 1);
                break;
            case "week":
                startDate.setDate(now.getDate() - 7);
                break;
            case "month":
                startDate.setMonth(now.getMonth() - 1);
                break;
            case "year":
                startDate.setFullYear(now.getFullYear() - 1);
                break;
        }

        let data;

        switch (type) {
            case "revenue": {
                const transactions = await prisma.transaction.findMany({
                    where: {
                        status: "COMPLETED",
                        createdAt: { gte: startDate },
                    },
                    select: { amount: true, method: true, createdAt: true },
                });

                const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
                const byMethod: Record<string, number> = {};
                transactions.forEach((t) => {
                    byMethod[t.method] = (byMethod[t.method] || 0) + t.amount;
                });

                data = {
                    totalRevenue,
                    revenue: totalRevenue, // Alias
                    transactionCount: transactions.length,
                    byMethod,
                    router_status: "N/A", // Dashboard requirements
                    active_users: 0, // Dashboard requirements
                };
                break;
            }

            case "clients": {
                const [total, active, inactive, newClients] = await Promise.all([
                    prisma.client.count(),
                    prisma.client.count({ where: { status: "ACTIVE" } }),
                    prisma.client.count({ where: { status: { in: ["INACTIVE", "EXPIRED", "SUSPENDED"] } } }),
                    prisma.client.count({ where: { createdAt: { gte: startDate } } }),
                ]);

                data = { 
                    total, active, inactive, newClients,
                    revenue: 0, // Dashboard requirements
                    router_status: "N/A", // Dashboard requirements
                    active_users: active, // Dashboard requirements
                };
                break;
            }

            case "subscriptions": {
                const [active, expired, total] = await Promise.all([
                    prisma.subscription.count({ where: { status: "ACTIVE" } }),
                    prisma.subscription.count({ where: { status: "EXPIRED" } }),
                    prisma.subscription.count(),
                ]);

                data = { 
                    active, expired, total,
                    revenue: 0, // Dashboard requirements
                    router_status: "N/A", // Dashboard requirements
                    active_users: active, // Dashboard requirements
                };
                break;
            }

            default:
                return errorResponse("Invalid report type");
        }

        return jsonResponse({ 
            period, 
            type, 
            data,
            revenue: data.revenue,
            router_status: data.router_status,
            active_users: data.active_users,
        });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
