import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

/**
 * GET /api/hotspot/packages
 *
 * Public endpoint used by the MikroTik hotspot login portal.
 * Returns ACTIVE HOTSPOT packages, optionally filtered by routerId.
 *
 * Query params:
 * - routerId: string (optional)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const routerId = searchParams.get("routerId") || searchParams.get("router_id") || "";

        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const globalDb = getTenantClient(null);
        const router = await globalDb.router.findUnique({
            where: { id: routerId },
            select: { id: true, tenantId: true },
        });
        if (!router) return errorResponse("Router not found", 404);
        const db = getTenantClient(router.tenantId);

        const packages = await db.package.findMany({
            where: {
                type: "HOTSPOT",
                status: "ACTIVE",
                routerId,
                tenantId: router.tenantId,
            },
            orderBy: { createdAt: "desc" }
        });

        return jsonResponse(packages.map((p: any) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            price: p.price,
            duration: p.duration,
            durationUnit: p.durationUnit,
            uploadSpeed: p.uploadSpeed,
            uploadUnit: p.uploadUnit,
            downloadSpeed: p.downloadSpeed,
            downloadUnit: p.downloadUnit,
            devices: p.devices,
            hotspotType: p.hotspotType
        })));
    } catch (e: any) {
        console.error("[HOTSPOT PACKAGES ERROR]:", e);
        return errorResponse("Internal server error", 500);
    }
}

