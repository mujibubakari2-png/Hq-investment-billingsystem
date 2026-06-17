import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { NextRequest } from "next/server";

// GET /api/reports
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "reports:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

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
                const transactions = await db.transaction.findMany({
                    where: {
                        status: "COMPLETED",
                        createdAt: { gte: startDate },
                        ...tenantFilter
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
                    db.client.count({ where: { ...tenantFilter } }),
                    db.client.count({ where: { status: "ACTIVE", ...tenantFilter } }),
                    db.client.count({ where: { status: { in: ["INACTIVE", "EXPIRED", "SUSPENDED"] }, ...tenantFilter } }),
                    db.client.count({ where: { createdAt: { gte: startDate }, ...tenantFilter } }),
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
                    db.subscription.count({ where: { status: "ACTIVE", ...tenantFilter } }),
                    db.subscription.count({ where: { status: "EXPIRED", ...tenantFilter } }),
                    db.subscription.count({ where: { ...tenantFilter } }),
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

