import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { NextRequest } from "next/server";
import { getTenantFilter } from "@/lib/tenant";
import logger from "@/lib/logger";

// GET /api/reports
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "reports:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter: tenantFilter } = getTenantFilter(userPayload);

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
                // HIGH-PERF FIX: Use DB-side aggregate() instead of loading ALL rows into Node memory.
                // Previously: findMany({select: {amount}}) + JS reduce.
                // At scale (years of transactions, thousands of tenants) this would OOM the server.
                // Now: single DB aggregate query returning only the sum and count.
                const [agg, byMethodGroups] = await Promise.all([
                    db.transaction.aggregate({
                        where: { status: "COMPLETED", createdAt: { gte: startDate }, ...tenantFilter },
                        _sum:   { amount: true },
                        _count: { _all: true },
                    }),
                    db.transaction.groupBy({
                        by: ["method"],
                        where: { status: "COMPLETED", createdAt: { gte: startDate }, ...tenantFilter },
                        _sum: { amount: true },
                    }),
                ]);

                const totalRevenue = agg._sum.amount ? Number(agg._sum.amount) : 0;
                const byMethod: Record<string, number> = {};
                for (const g of byMethodGroups) {
                    byMethod[g.method] = g._sum.amount ? Number(g._sum.amount) : 0;
                }

                data = {
                    totalRevenue,
                    revenue: totalRevenue,
                    transactionCount: agg._count._all,
                    byMethod,
                    router_status: "N/A",
                    active_users: 0,
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
        logger.error('[reports] GET failed', { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
