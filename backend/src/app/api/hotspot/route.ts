import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/hotspot - list all hotspot subscribers for the tenant
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const routerId = searchParams.get("routerId") || "All";
        const page = parseInt(searchParams.get("page") || "1");
        const limitParam = searchParams.get("limit") || "25";
        const limit = limitParam === "All" ? 999999 : parseInt(limitParam);

        // Filter for ACTIVE subscriptions with client type HOTSPOT
        const whereCondition: any = { 
            status: "ACTIVE", 
            client: { serviceType: "HOTSPOT" },
            ...tenantFilter 
        };

        if (routerId !== "All") {
            whereCondition.routerId = routerId;
        }

        const subscriptions = await prisma.subscription.findMany({
            where: whereCondition,
            include: { client: true, package: true, router: true },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        });

        const total = await prisma.subscription.count({ where: whereCondition });

        // Date helper
        const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

        const mapped = subscriptions.map(s => ({
            id: s.id,
            username: s.client?.username || "Unknown",
            fullName: s.client?.fullName || "Unknown",
            plan: s.package?.name || "N/A",
            price: s.package?.price || 0,
            router: s.router?.name || "N/A",
            macAddress: s.client?.macAddress || "N/A",
            expiresAt: isValidDate(s.expiresAt) ? s.expiresAt.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }) : "N/A",
            online: s.onlineStatus === "ONLINE" ? "Online" : "Offline",
            status: "Active",
            createdAt: s.createdAt
        }));

        if (search) {
            const filtered = mapped.filter(s => 
                s.username.toLowerCase().includes(search) || 
                s.fullName.toLowerCase().includes(search) ||
                s.macAddress.toLowerCase().includes(search)
            );
            return jsonResponse({ data: filtered, total: filtered.length });
        }

        return jsonResponse({
            data: mapped,
            total,
            page,
            limit
        });

    } catch (e) {
        console.error("Hotspot subscribers GET error:", e);
        return errorResponse("Internal server error", 500);
    }
}
