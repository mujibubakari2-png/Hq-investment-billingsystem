import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const type = searchParams.get("type") || "All";
        const routerId = searchParams.get("routerId") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Define filter conditions
        const whereCondition: any = { status: "EXPIRED", ...tenantFilter };
        if (routerId !== "All") {
            whereCondition.routerId = routerId;
        }

        // Fetch all subscriptions with EXPIRED status for stats computation
        const allExpired = await prisma.subscription.findMany({
            where: whereCondition,
            include: { client: true, package: true, router: true },
            orderBy: { expiresAt: "desc" }
        });

        // Compute active subscriptions strictly for the active stat tally
        const activeCount = await prisma.subscription.count({ where: { status: "ACTIVE", ...tenantFilter }});

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

        // Date Format helper
        const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

        // Format all expired subscriptions natively
        const allMapped = allExpired.map(s => {
            const expires = new Date(s.expiresAt);
            const expiredDays = isValidDate(expires) ? Math.max(0, Math.floor((now.getTime() - expires.getTime()) / (1000 * 3600 * 24))) : 0;
            
            return {
                id: s.id,
                username: s.client?.username || "Unknown",
                plan: s.package?.name || "N/A",
                type: s.client?.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                router: s.router?.name || "N/A",
                expiredDate: isValidDate(expires) ? expires.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }) : "N/A",
                expiredTimestamp: isValidDate(expires) ? expires.getTime() : 0,
                days: expiredDays,
                method: s.method || "Manual",
            };
        });

        const summaries = {
            totalExpired: allMapped.length,
            thisWeek: allMapped.filter(s => s.expiredTimestamp >= startOfWeek).length,
            extendedToday: 0, // Placeholder as extended isn't tracked purely in EXPIRED state
            pppoe: allMapped.filter(s => s.type === "PPPoE").length,
            hotspot: allMapped.filter(s => s.type === "Hotspot").length,
            active: activeCount
        };

        // Filter by user search and UI tabs natively on the server
        const filtered = allMapped.filter(s => {
            const matchTab = type === "All" || s.type === type;
            const matchSearch = search === "" || s.username.toLowerCase().includes(search);
            return matchTab && matchSearch;
        });

        // Paginate slice
        const total = filtered.length;
        const paginatedSubs = filtered.slice((page - 1) * limit, page * limit);

        return jsonResponse({
            data: paginatedSubs,
            total,
            summaries
        });
    } catch (e) {
        console.error("Expired subscribers fetch error:", e);
        return errorResponse("Internal server error", 500);
    }
}
