import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter } from "@/lib/tenant";
import { toISOSafe, toTimestampSafe, getStartOfTodayTZ, getStartOfMonthTZ, getEndOfMonthTZ } from "@/lib/dateUtils";
import logger from "@/lib/logger";

function formatTransactionStatus(status: unknown) {
    const raw = typeof status === "string" && status.trim() ? status.trim().toUpperCase() : "PENDING";
    return raw.charAt(0) + raw.slice(1).toLowerCase();
}

export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "transactions:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter: tenantFilter, isPlatformSuperAdmin, isTenantSuperAdmin } = getTenantFilter(userPayload);

        // Super Admin can override tenant filter via query param
        const url = new URL(req.url);
        const searchParams = url.searchParams;
        const targetTenantId = searchParams.get("tenantId");
        if ((isPlatformSuperAdmin || isTenantSuperAdmin) && targetTenantId) {
            tenantFilter.tenantId = targetTenantId;
        }

        let activeGws: string[] = [];
        try {
            const activeChannels = await db.paymentChannel.findMany({
                where: { status: "ACTIVE", ...tenantFilter },
                select: { provider: true, name: true },
            });
            activeGws = Array.from(new Set(activeChannels.flatMap((ch: any) => [ch.provider, ch.name].filter(Boolean).map((v: string) => v.toLowerCase()))));
        } catch { }

        // Parse URL Query Parameters for server-side pagination and filtering
        const search = searchParams.get("search")?.toLowerCase() || "";
        const status = searchParams.get("status") || "All";
        const methodFilter = searchParams.get("method") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Fetch mobile payment transactions scoped by tenantId
        const transactions = await db.transaction.findMany({
            where: { type: "MOBILE", ...tenantFilter },
            include: { client: { select: { username: true, fullName: true } } },
            orderBy: { createdAt: "desc" },
        });

        const allMapped = transactions.map((t: any) => ({
            id: t.id,
            user: t.client?.username || "Unknown",
            planName: t.planName,
            plan: t.planName,
            amount: t.amount,
            type: t.type.charAt(0) + t.type.slice(1).toLowerCase(),
            method: t.method || "Cash",
            status: formatTransactionStatus(t.status),
            date: toISOSafe(t.createdAt),
            timestamp: toTimestampSafe(t.createdAt),
            expiryDate: toISOSafe(t.expiryDate),
            reference: t.providerRef || t.reference,
            transactionId: t.providerRef || t.reference,
            providerRef: t.providerRef,
        }));

        const channelTxs = allMapped;

        // Compute Summaries (Always computed unconditionally against all channel transactions, unfiltered by search)
        // Fixed: Use timezone-aware boundaries (Africa/Dar_es_Salaam) to match frontend display
        const startOfToday = getStartOfTodayTZ();
        const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
        const startOfMonth = getStartOfMonthTZ();
        const endOfMonth = getEndOfMonthTZ();

        const todayTxs = channelTxs.filter(t => t.timestamp >= startOfToday && t.timestamp <= endOfToday);
        const monthTxs = channelTxs.filter(t => t.timestamp >= startOfMonth && t.timestamp <= endOfMonth);

        const summaries = {
            today: {
                total: todayTxs.length,
                paid: todayTxs.filter(t => t.status === "Completed" || t.status === "Paid").length,
                revenue: todayTxs.filter(t => t.status === "Completed" || t.status === "Paid").reduce((sum, t) => sum + (t.amount || 0), 0)
            },
            month: {
                total: monthTxs.length,
                paid: monthTxs.filter(t => t.status === "Completed" || t.status === "Paid").length,
                expired: monthTxs.filter(t => t.status === "Expired" || (t.status === "Pending" && t.expiryDate && new Date(t.expiryDate).getTime() < Date.now())).length,
                pending: monthTxs.filter(t => t.status === "Pending" && (!t.expiryDate || new Date(t.expiryDate).getTime() >= Date.now())).length,
                unpaid: monthTxs.filter(t => t.status === "Unpaid").length,
                cancelled: monthTxs.filter(t => t.status === "Failed" || t.status === "Cancelled").length,
                revenue: monthTxs.filter(t => t.status === "Completed" || t.status === "Paid").reduce((sum, t) => sum + (t.amount || 0), 0)
            }
        };

        // Apply Server-side User Filters
        const filtered = channelTxs.filter(tx => {
            const matchSearch = search === "" ||
                (tx.user || '').toLowerCase().includes(search) ||
                (tx.planName || '').toLowerCase().includes(search) ||
                (tx.reference || '').toLowerCase().includes(search) ||
                (tx.method || '').toLowerCase().includes(search);

            const matchStatus = status === 'All' ||
                (status === 'Completed' && (tx.status === 'Completed' || tx.status === 'Paid')) ||
                (status === 'Pending' && tx.status === 'Pending') ||
                (status === 'Failed' && (tx.status === 'Failed' || tx.status === 'Cancelled'));

            const matchMethod = methodFilter === 'All' ||
                (tx.method || '').toLowerCase().includes(methodFilter.toLowerCase());

            return matchSearch && matchStatus && matchMethod;
        });

        // Paginate
        const total = filtered.length;
        const paginatedTxs = filtered.slice((page - 1) * limit, page * limit);

        return jsonResponse({
            data: paginatedTxs,
            total,
            summaries,
            activeGateways: activeGws
        });
    } catch (e) {
        logger.error("[route] error", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
