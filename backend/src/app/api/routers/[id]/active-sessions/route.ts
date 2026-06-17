import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { requirePermission } from "@/lib/rbac";

// GET /api/routers/[id]/sessions — List active sessions (PPPoE + Hotspot)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const { id } = await params;
        const service = await getMikroTikService(id, userPayload.tenantId ?? null);
        const sessions = await service.listAllActiveSessions();
        return jsonResponse(sessions);
    } catch (err: any) {
        return errorResponse("Failed to list active sessions", 500);
    }
}
