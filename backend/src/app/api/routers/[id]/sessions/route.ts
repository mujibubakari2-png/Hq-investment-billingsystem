import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/routers/[id]/sessions — List active sessions (PPPoE + Hotspot)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const service = await getMikroTikService(id);
        const sessions = await service.listAllActiveSessions();
        return jsonResponse(sessions);
    } catch (err: any) {
        return errorResponse(err.message || "Failed to list active sessions", 500);
    }
}
