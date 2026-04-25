import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { toISOSafe } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const type = searchParams.get("type") || "All"; // PPPoE or Hotspot
        const onlineStatus = searchParams.get("onlineStatus") || "All"; // Online or Offline
        const routerId = searchParams.get("routerId") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Base filter for ACTIVE status
        const whereCondition: any = { status: "ACTIVE", ...tenantFilter };

        if (routerId !== "All") {
            whereCondition.routerId = routerId;
        }

        // Fetch all active for stats calculations
        const allActive = await prisma.subscription.findMany({
            where: whereCondition,
            include: { client: true, package: true, router: true },
            orderBy: { createdAt: "desc" }
        });

        // Map to common UI format
        const allMapped = allActive.map(s => {
            return {
                id: s.id,
                user: s.client?.username || "Unknown",
                username: s.client?.username || "Unknown",
                plan: s.package?.name || "N/A",
                type: s.client?.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                device: s.client?.device || "N/A",
                macAddress: s.client?.macAddress || "N/A",
                created: toISOSafe(s.createdAt),
                expires: toISOSafe(s.expiresAt),
                method: s.method || "Manual",
                router: s.router?.name || "N/A",
                routerId: s.routerId || "",
                status: "Active",
                online: s.onlineStatus === "ONLINE" ? "Online" : "Offline",
                sync: s.syncStatus || "Synced"
            };
        });

        // Compute summaries
        const summaries = {
            totalActive: allMapped.length,
            online: allMapped.filter(s => s.online === "Online").length,
            offline: allMapped.filter(s => s.online === "Offline").length,
            pppoe: allMapped.filter(s => s.type === "PPPoE").length,
            hotspot: allMapped.filter(s => s.type === "Hotspot").length,
        };

        // Filter by user search, type tab, and online status tab
        const filtered = allMapped.filter(s => {
            const matchType = type === "All" || s.type === type;
            const matchOnline = onlineStatus === "All" || s.online === onlineStatus;
            const matchSearch = search === "" || 
                s.username.toLowerCase().includes(search) || 
                s.plan.toLowerCase().includes(search) || 
                s.macAddress.toLowerCase().includes(search);
            return matchType && matchOnline && matchSearch;
        });

        // Paginate
        const total = filtered.length;
        const data = filtered.slice((page - 1) * limit, page * limit);

        return jsonResponse({
            data,
            total,
            summaries
        });

    } catch (e) {
        console.error("Active subscribers GET error:", e);
        return errorResponse("Internal server error", 500);
    }
}
