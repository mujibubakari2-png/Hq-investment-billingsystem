import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
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

        if (routerId) {
            const router = await prisma.router.findUnique({
                where: { id: routerId },
                select: { id: true }
            });
            if (!router) return errorResponse("Router not found", 404);
        }

        const packages = await prisma.package.findMany({
            where: {
                type: "HOTSPOT",
                status: "ACTIVE",
                ...(routerId ? { routerId } : {})
            },
            orderBy: { createdAt: "desc" }
        });

        return jsonResponse(packages.map(p => ({
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

