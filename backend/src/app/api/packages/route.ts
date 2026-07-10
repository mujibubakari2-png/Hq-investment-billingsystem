import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";
import { PackageCreateSchema } from "@/lib/validators";
import { getMikroTikService } from "@/lib/mikrotik";
import logger from "@/lib/logger";

// GET /api/packages
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "packages:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const type     = searchParams.get("type")     || "";
        const status   = searchParams.get("status")   || "";
        const routerId = searchParams.get("routerId") || "";
        const page     = Math.max(1, parseInt(searchParams.get("page")  || "1"));
        const limit    = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "200")));
        const skip     = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (type) {
            where.type = type.toUpperCase() === "HOTSPOT" ? "HOTSPOT"
                       : type.toUpperCase() === "PPPOE"   ? "PPPOE"
                       : type;
        }
        if (status) {
            where.status = status.toUpperCase() === "ACTIVE"   ? "ACTIVE"
                         : status.toUpperCase() === "INACTIVE" ? "INACTIVE"
                         : status;
        }
        if (routerId) where.routerId = routerId;

        // HIGH-PERF FIX: Was unbounded findMany — now paginated with DB-level skip/take/count.
        const [packages, total] = await Promise.all([
            db.package.findMany({
                where,
                include: { router: { select: { name: true } } },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db.package.count({ where }),
        ]);

        const mapped = packages.map((p: {
            id: string;
            name: string;
            type: string;
            category: string;
            uploadSpeed: number;
            uploadUnit: string;
            downloadSpeed: number;
            downloadUnit: string;
            price: any;
            router: { name: string } | null;
            duration: number;
            durationUnit: string;
            status: string;
            burstEnabled: boolean;
            hotspotType: string | null;
            devices: number | null;
            paymentType: string;
        }) => ({
            id:            p.id,
            name:          p.name,
            type:          p.type === "HOTSPOT" ? "Hotspot" : "PPPoE",
            category:      p.category === "PERSONAL" ? "Personal" : "Business",
            bandwidth:     `${p.uploadSpeed}${p.uploadUnit[0]}/${p.downloadSpeed}${p.downloadUnit[0]}`,
            uploadSpeed:   p.uploadSpeed,
            uploadUnit:    p.uploadUnit,
            downloadSpeed: p.downloadSpeed,
            downloadUnit:  p.downloadUnit,
            price:         p.price,
            router:        p.router?.name || "",
            validity:      `${p.duration} ${p.durationUnit.charAt(0) + p.durationUnit.slice(1).toLowerCase()}`,
            duration:      p.duration,
            durationUnit:  p.durationUnit.charAt(0) + p.durationUnit.slice(1).toLowerCase(),
            status:        p.status === "ACTIVE" ? "Active" : "Inactive",
            burstEnabled:  p.burstEnabled,
            hotspotType:   p.hotspotType === "DATA_CAPPED" ? "Data-capped" : "Unlimited",
            devices:       p.devices,
            paymentType:   p.paymentType === "POSTPAID" ? "Postpaid" : "Prepaid",
        }));

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        logger.error("[packages] GET failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/packages
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "packages:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const body = await req.json() as any;

        // Normalize frontend display values → schema enum values before validation
        const normalized = {
            ...body,
            type:         body.type === "PPPoE" ? "PPPOE" : body.type === "Hotspot" ? "HOTSPOT" : (body.type || "").toUpperCase(),
            category:     body.category === "Business" ? "BUSINESS" : body.category === "Personal" ? "PERSONAL" : (body.category || "").toUpperCase(),
            paymentType:  body.paymentType === "Postpaid" ? "POSTPAID" : body.paymentType === "Prepaid" ? "PREPAID" : (body.paymentType || "").toUpperCase(),
            durationUnit: (body.durationUnit || "").toUpperCase(),
            hotspotType:  body.hotspotType === "Data-capped" ? "DATA_CAPPED" : body.hotspotType === "Unlimited" ? "UNLIMITED" : body.hotspotType,
            uploadSpeed:   body.uploadSpeed  !== undefined ? Number(body.uploadSpeed)           : undefined,
            downloadSpeed: body.downloadSpeed !== undefined ? Number(body.downloadSpeed)         : undefined,
            price:         body.price         !== undefined ? Number(body.price)                : undefined,
            duration:      body.duration      !== undefined ? parseInt(String(body.duration))   : undefined,
            devices:       body.devices       !== undefined ? parseInt(String(body.devices))    : undefined,
        };

        const parsed = PackageCreateSchema.safeParse(normalized);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
            logger.warn("[packages] Validation failed", { issues: parsed.error.issues, input: JSON.stringify(normalized) });
            return errorResponse(`Validation failed: ${msg}`, 400);
        }
        const validatedData = parsed.data;

        let routerId = validatedData.routerId;
        let routerTenantId: string | null | undefined = userPayload.tenantId;

        if (routerId) {
            const router = await db.router.findFirst({
                where: {
                    OR: [{ id: routerId }, { name: routerId }],
                    ...tenantFilter,
                },
            });
            if (!router) return errorResponse("Router not found or you don't have permission to use it", 404);
            routerId        = router.id;
            routerTenantId  = router.tenantId;
        }

        const pkg = await db.package.create({
            data: {
                ...validatedData,
                routerId: routerId || null,
                status:   "ACTIVE",
                tenantId: getAssignTenantId(userPayload, routerTenantId),
            },
        });

        // Best-effort: sync MikroTik bandwidth profile to match this package
        if (pkg.routerId) {
            try {
                const mikrotik = await getMikroTikService(pkg.routerId, userPayload.tenantId ?? null);
                await mikrotik.createProfileFromPackage(
                    pkg.name,
                    pkg.uploadSpeed,
                    pkg.uploadUnit,
                    pkg.downloadSpeed,
                    pkg.downloadUnit,
                    pkg.type === "PPPOE" ? "pppoe" : "hotspot",
                    pkg.devices || 1,
                );
                await db.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        tenantId: pkg.tenantId,
                        action:   "package_profile_synced",
                        details:  `Synced profile for package "${pkg.name}" (${pkg.type})`,
                        status:   "success",
                    },
                });
            } catch (err: any) {
                logger.error("[packages] MikroTik sync failed", { error: err instanceof Error ? err.message : String(err) });
                await db.routerLog.create({
                    data: {
                        routerId: pkg.routerId,
                        tenantId: pkg.tenantId,
                        action:   "package_profile_sync_failed",
                        details:  `Failed to sync profile for "${pkg.name}": ${err?.message || "Unknown error"}`,
                        status:   "error",
                    },
                });
                // Package was created — return success with warning, don't roll back
                return jsonResponse({ ...pkg, warning: "Package was created but MikroTik sync failed. Try syncing again later." }, 201);
            }
        }

        return jsonResponse(pkg, 201);
    } catch (e: any) {
        logger.error("[packages] POST failed", { error: e instanceof Error ? e.message : String(e) });
        const msg = e?.message?.includes("Unique constraint") ? "A package with that name already exists."
                  : e?.message?.includes("Foreign key")       ? "Invalid router reference."
                  : "Internal server error";
        return errorResponse(msg, 500);
    }
}
