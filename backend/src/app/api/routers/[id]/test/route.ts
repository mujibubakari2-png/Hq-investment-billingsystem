import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// POST /api/routers/[id]/test — Test connection to a router
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const service = await getMikroTikService(id);
        const result = await service.testConnection();

        // Always return 200 — the `success` field in the body indicates
        // whether the router was reachable. Returning 502 caused the
        // frontend's generic request() helper to throw before the caller
        // could read the actual error message.
        return jsonResponse(result, 200);
    } catch (err: any) {
        // Router not found in DB or other server error
        return jsonResponse(
            { success: false, message: err.message || "Failed to test connection" },
            200
        );
    }
}
