import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/routers/[id]/sessions — List active sessions (PPPoE + Hotspot)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const service = await getMikroTikService(id, userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);
        const sessions = await service.listAllActiveSessions();
        return jsonResponse(sessions);
    } catch (err: any) {
        return errorResponse("Failed to list active sessions", 500);
    }
}
