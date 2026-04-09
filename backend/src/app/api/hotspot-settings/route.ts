import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/hotspot-settings?routerId=...
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const routerId = searchParams.get("routerId");

        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const router = await prisma.router.findUnique({ where: { id: routerId } });
        if (!router) return errorResponse("Router not found", 404);
        
        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to access this router's settings", 403);
        }

        let settings = await prisma.hotspotSettings.findUnique({
            where: { routerId },
        });

        // If no settings exist yet, return defaults or empty
        if (!settings) {
            // We could return defaults here, or let the frontend handle it
            // Let's create defaults for this router
            settings = await prisma.hotspotSettings.create({
                data: {
                    routerId,
                    tenantId: router.tenantId
                }
            });
        }

        return jsonResponse(settings);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/hotspot-settings
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { routerId, ...data } = body;

        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const router = await prisma.router.findUnique({ where: { id: routerId } });
        if (!router) return errorResponse("Router not found", 404);
        
        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to update this router's settings", 403);
        }

        const tenantId = router.tenantId;

        const settings = await prisma.hotspotSettings.upsert({
            where: { routerId },
            update: {
                ...data,
            },
            create: {
                routerId,
                ...data,
                tenantId: tenantId || null,
            },
        });

        return jsonResponse(settings);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
