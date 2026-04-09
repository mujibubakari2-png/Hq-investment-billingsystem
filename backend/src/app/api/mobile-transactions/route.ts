import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { toISOSafe, toTimestampSafe, getStartOfTodayTZ, getStartOfMonthTZ, getEndOfMonthTZ } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

        // Super Admin can override tenant filter via query param
        const url = new URL(req.url);
        const searchParams = url.searchParams;
        const targetTenantId = searchParams.get("tenantId");
        if (isSuperAdmin && targetTenantId) {
            tenantFilter.tenantId = targetTenantId;
        }
        
        // Fetch settings to determine active gateways scoped by tenantId
        let gwSetting = await prisma.systemSetting.findFirst({ where: { key: 'paymentGateways', ...tenantFilter } });
        
        // Fallback to global setting if no tenant-specific override exists
        if (!gwSetting && !isSuperAdmin) {
            gwSetting = await prisma.systemSetting.findFirst({ where: { key: 'paymentGateways', tenantId: null } });
        }
        
        let activeGws: string[] = [];
        
        if (gwSetting?.value) {
            try {
                const parsed = JSON.parse(gwSetting.value);
                if (Array.isArray(parsed)) {
                    activeGws = parsed.filter((g: any) => g.enabled).map((g: any) => g.name.toLowerCase());
                }
            } catch (e) { }
        }

        // Parse URL Query Parameters for server-side pagination and filtering
        const search = searchParams.get("search")?.toLowerCase() || "";
        const status = searchParams.get("status") || "All";
        const methodFilter = searchParams.get("method") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Fetch all transactions scoped by tenantId
        const transactions = await prisma.transaction.findMany({
            where: { ...tenantFilter },
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
            status: t.status.charAt(0) + t.status.slice(1).toLowerCase(),
            date: toISOSafe(t.createdAt),
            timestamp: toTimestampSafe(t.createdAt),
            expiryDate: toISOSafe(t.expiryDate),
            reference: t.reference || t.transactionId,
        }));

        // Base filter: Strictly match active payment channels
        const channelTxs = allMapped.filter(tx => {
            const m = (tx.method || "").toLowerCase();
            return activeGws.some(g => m.includes(g) || g.includes(m));
        });

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
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
