import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { requirePermission } from "@/lib/rbac";

// POST /api/routers/[id]/sessions/disconnect — Disconnect a session
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const { id } = await params;
        const body = await req.json();

        if (!body.sessionId || !body.service) {
            return errorResponse("sessionId and service (pppoe/hotspot) are required");
        }

        const service = await getMikroTikService(id, userPayload.tenantId ?? null);

        if (body.service === "pppoe") {
            await service.disconnectPPPoESession(body.sessionId, body.username);
        } else {
            await service.disconnectHotspotSession(body.sessionId, body.username);
        }

        return jsonResponse({ message: `User ${body.username || body.sessionId} disconnected` });
    } catch (err: any) {
        return errorResponse("Failed to disconnect session", 500);
    }
}
