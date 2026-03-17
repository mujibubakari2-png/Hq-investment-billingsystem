import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// POST /api/routers/[id]/test — Test connection to a router
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const service = await getMikroTikService(id);
        const result = await service.testConnection();
        return jsonResponse(result, result.success ? 200 : 502);
    } catch (err: any) {
        return errorResponse(err.message || "Failed to test connection", 500);
    }
}
