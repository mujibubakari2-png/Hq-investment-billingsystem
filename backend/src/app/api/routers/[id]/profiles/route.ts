import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/routers/[id]/profiles — List bandwidth profiles
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const url = new URL(req.url);
        const type = url.searchParams.get("type") || "all";

        const service = await getMikroTikService(id, userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);

        if (type === "pppoe") {
            return jsonResponse(await service.listPPPoEProfiles());
        } else if (type === "hotspot") {
            return jsonResponse(await service.listHotspotProfiles());
        }

        // Return both
        const [pppoe, hotspot] = await Promise.allSettled([
            service.listPPPoEProfiles(),
            service.listHotspotProfiles(),
        ]);

        return jsonResponse({
            pppoe: pppoe.status === "fulfilled" ? pppoe.value : [],
            hotspot: hotspot.status === "fulfilled" ? hotspot.value : [],
        });
    } catch (err: any) {
        return errorResponse("Failed to list profiles", 500);
    }
}

// POST /api/routers/[id]/profiles — Create bandwidth profile
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const body = await req.json();

        if (!body.name || !body.rateLimit || !body.type) {
            return errorResponse("name, rateLimit, and type (pppoe/hotspot) are required");
        }

        const service = await getMikroTikService(id, userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);

        if (body.type === "pppoe") {
            const profile = await service.createPPPoEProfile({
                name: body.name,
                rateLimit: body.rateLimit,
                comment: body.comment,
            });
            return jsonResponse(profile, 201);
        } else {
            const profile = await service.createHotspotProfile({
                name: body.name,
                rateLimit: body.rateLimit,
                sharedUsers: body.sharedUsers || 1,
                comment: body.comment,
            });
            return jsonResponse(profile, 201);
        }
    } catch (err: any) {
        return errorResponse("Failed to create profile", 500);
    }
}
