import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { syncRadiusUser } from "@/lib/radius";
import { parseSafeDate, toISOSafe, toTimestampSafe, isValidDate } from "@/lib/dateUtils";
import { invalidateNamespace } from "@/lib/cache";


// GET /api/subscriptions
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        // PERF-001: Clamp limit to 200 to prevent clients requesting unbounded data
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
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
            db.subscription.findMany({
                where,
                include: {
                    client: true,
                    package: true,
                    // DB-006 / SEC-002 FIX: Never return router.password, wgPrivateKey, or wgPresharedKey
                    // to the frontend. Use select to return only safe display fields.
                    router: { select: { id: true, name: true, host: true, status: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db.subscription.count({ where }),
        ]);

        const mapped = subs.map((s) => {
            const expiresTs = toTimestampSafe(s.expiresAt);
            const nowTs = Date.now();
            // E07 FIX: was (nowTs - expiresTs) which computed ELAPSED days; now correctly computes REMAINING days
            const days = expiresTs > 0 ? Math.max(0, Math.floor((expiresTs - nowTs) / (1000 * 3600 * 24))) : 0;
            
            return {
                id: s.id,
                user: s.client?.username || "Unknown",
                username: s.client?.username || "Unknown",
                plan: s.package?.name || "N/A",
                package: s.package?.name || "N/A",
                type: s.client?.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                device: s.client?.device || "",
                macAddress: s.client?.macAddress || "",
                created: toISOSafe(s.createdAt),
                expires: toISOSafe(s.expiresAt),
                expiresAt: toISOSafe(s.expiresAt),
                expiryDate: toISOSafe(s.expiresAt),
                startDate: toISOSafe(s.activatedAt) || toISOSafe(s.createdAt),
                activatedAt: toISOSafe(s.activatedAt),
                expiredDate: toISOSafe(s.expiresAt),
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";

        const body = await req.json();
        
        const clientId = body.clientId || body.client;
        const packageId = body.packageId || body.package;
        const routerId = body.routerId || body.router;

        if (!clientId || !packageId) {
            return errorResponse(`clientId and packageId are required. Got clientId: ${clientId}, packageId: ${packageId}`);
        }

        // Verify client belongs to tenant
        const client = await db.client.findUnique({ where: { id: clientId } });
        if (!client) return errorResponse("Client not found", 404);
        if (!isSuperAdmin && client.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        const tenantIdValue = isSuperAdmin ? client.tenantId : userPayload.tenantId;

        const sub = await db.subscription.create({
            data: {
                clientId,
                packageId,
                routerId,
                method: body.method || "MANUAL",
                expiresAt: parseSafeDate(body.expiresAt) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                activatedAt: parseSafeDate(body.activatedAt) || new Date(),
                status: "ACTIVE",
                syncStatus: "PENDING",
                tenantId: tenantIdValue,
            },
            include: { client: true, package: true, router: true },
        });

        // ── Sync to RADIUS (always, regardless of router availability) ─────────
        if (sub.client && sub.package) {
            try {
                const expiresAt = parseSafeDate(body.expiresAt) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const pkg = sub.package;
                let rateLimit: string | undefined;
                if (pkg.uploadSpeed && pkg.downloadSpeed) {
                    const ulUnit = pkg.uploadUnit === "Mbps" ? "M" : "k";
                    const dlUnit = pkg.downloadUnit === "Mbps" ? "M" : "k";
                    rateLimit = `${pkg.uploadSpeed}${ulUnit}/${pkg.downloadSpeed}${dlUnit}`;
                }
                await syncRadiusUser({
                    username: sub.client.username,
                    password: sub.client.phone || undefined,
                    tenantId: sub.tenantId || null,
                    fullName: sub.client.fullName || undefined,
                    expiresAt,
                    status: "Active",
                    rateLimit,
                    profileName: pkg.name,
                });
            } catch (radErr: any) {
                console.error("RADIUS sync error (manual sub):", radErr);
            }
        }

        // ── Activate on MikroTik router (if router is set) ────────────────────
        if (sub.routerId && sub.client && sub.package) {
            try {
                const mikrotik = await getMikroTikService(sub.routerId);
                const pwd = sub.client.phone || "123456";
                const type = sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                await mikrotik.activateService(sub.client.username, pwd, sub.package.name, type);
                
                await db.subscription.update({ where: { id: sub.id }, data: { syncStatus: "SYNCED" } });
                await db.routerLog.create({
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
                await db.subscription.update({ where: { id: sub.id }, data: { syncStatus: "FAILED_SYNC" } });
                await db.routerLog.create({
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

        // Invalidate dashboard cache so next load reflects new subscription
        if (sub.tenantId) {
            invalidateNamespace(sub.tenantId, 'dashboard').catch(() => {});
        }

        // DB-006 FIX: Return a safe mapped response — never expose router credentials or
        // client sensitive fields (password hash, phone) to the browser.
        return jsonResponse({
            id: sub.id,
            clientId: sub.clientId,
            packageId: sub.packageId,
            routerId: sub.routerId,
            status: sub.status,
            syncStatus: sub.syncStatus,
            method: sub.method,
            activatedAt: sub.activatedAt,
            expiresAt: sub.expiresAt,
            tenantId: sub.tenantId,
            createdAt: sub.createdAt,
            // Safe subset of related records
            client: sub.client ? { id: sub.client.id, username: sub.client.username, fullName: sub.client.fullName } : null,
            package: sub.package ? { id: sub.package.id, name: sub.package.name } : null,
            router: sub.router ? { id: sub.router.id, name: sub.router.name, host: sub.router.host, status: sub.router.status } : null,
        }, 201);
    } catch (e) {
        console.error("SUBSCRIPTION POST ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
