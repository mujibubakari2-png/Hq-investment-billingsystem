import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// POST /api/routers/[id]/sessions/disconnect — Disconnect a session
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const body = await req.json();

        if (!body.sessionId || !body.service) {
            return errorResponse("sessionId and service (pppoe/hotspot) are required");
        }

        const service = await getMikroTikService(id, userPayload.tenantId);

        if (body.service === "pppoe") {
            await service.disconnectPPPoESession(body.sessionId, body.username);
        } else {
            await service.disconnectHotspotSession(body.sessionId, body.username);
        }

        return jsonResponse({ message: `User ${body.username || body.sessionId} disconnected` });
    } catch (err: any) {
        return errorResponse(err.message || "Failed to disconnect session", 500);
    }
}
