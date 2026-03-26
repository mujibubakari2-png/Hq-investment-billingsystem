import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/subscriptions
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (status) where.status = status;
        if (search) {
            where.client = {
                OR: [
                    { username: { contains: search, mode: "insensitive" } },
                    { fullName: { contains: search, mode: "insensitive" } },
                ],
            };
        }

        const [subs, total] = await Promise.all([
            prisma.subscription.findMany({
                where,
                include: {
                    client: true,
                    package: true,
                    router: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.subscription.count({ where }),
        ]);

        const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

        const mapped = subs.map((s) => {
            const expires = new Date(s.expiresAt);
            const now = new Date();
            const days = (isValidDate(expires)) ? Math.max(0, Math.floor((now.getTime() - expires.getTime()) / (1000 * 3600 * 24))) : 0;
            
            return {
                id: s.id,
                user: s.client?.username || "Unknown",
                username: s.client?.username || "Unknown",
                plan: s.package?.name || "N/A",
                package: s.package?.name || "N/A",
                type: s.client?.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                device: s.client?.device || "",
                macAddress: s.client?.macAddress || "",
                created: isValidDate(s.createdAt) ? s.createdAt.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }) : "N/A",
                expires: isValidDate(s.expiresAt) ? s.expiresAt.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }) : "N/A",
                expiresAt: s.expiresAt,
                expiryDate: s.expiresAt || "N/A", // Ensure not null
                startDate: s.activatedAt || s.createdAt || new Date(),
                activatedAt: s.activatedAt,
                expiredDate: isValidDate(s.expiresAt) ? s.expiresAt.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }) : "N/A",
                method: s.method || "Manual",
                router: s.router?.name || "N/A",
                status: s.status === "ACTIVE" ? "Active" : s.status === "EXPIRED" ? "Expired" : "Suspended",
                online: s.onlineStatus === "ONLINE" ? "Online" : "Offline",
                sync: s.syncStatus || "Synced",
                days: days
            };
        });

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/subscriptions
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        const clientId = body.clientId || body.client;
        const packageId = body.packageId || body.package;
        const routerId = body.routerId || body.router;

        if (!clientId || !packageId) {
            return errorResponse(`clientId and packageId are required. Got clientId: ${clientId}, packageId: ${packageId}`);
        }

        const sub = await prisma.subscription.create({
            data: {
                clientId,
                packageId,
                routerId,
                method: body.method || "MANUAL",
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                activatedAt: body.activatedAt ? new Date(body.activatedAt) : new Date(),
                status: "ACTIVE",
                syncStatus: "PENDING",
            },
            include: { client: true, package: true, router: true },
        });

        if (sub.routerId && sub.client && sub.package) {
            try {
                const mikrotik = await getMikroTikService(sub.routerId);
                const pwd = sub.client.phone || "123456";
                const type = sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                await mikrotik.activateService(sub.client.username, pwd, sub.package.name, type);
                
                await prisma.subscription.update({ where: { id: sub.id }, data: { syncStatus: "SYNCED" } });
                await prisma.routerLog.create({
                    data: {
                        routerId: sub.routerId,
                        action: "MANUAL_SUB_ACTIVATED",
                        details: `Admin assigned ${type} plan ${sub.package.name} manually`,
                        status: "success",
                        username: sub.client.username
                    }
                });
            } catch (err: any) {
                console.error("Manual sub mikrotik sync error:", err);
                await prisma.subscription.update({ where: { id: sub.id }, data: { syncStatus: "FAILED_SYNC" } });
                await prisma.routerLog.create({
                    data: {
                        routerId: sub.routerId,
                        action: "MANUAL_SUB_ACTIVATED_FAILED",
                        details: `Failed to activate: ${err?.message || "Error"}`,
                        status: "error",
                        username: sub.client.username
                    }
                });
            }
        }

        return jsonResponse(sub, 201);
    } catch (e) {
        console.error("SUBSCRIPTION POST ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
