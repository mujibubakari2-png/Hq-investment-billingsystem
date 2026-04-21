import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";


export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = params.id;
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const service = await getMikroTikService(id, userPayload.role === "SUPER_ADMIN" ? null : userPayload.tenantId);
        const interfaces = await service.listInterfaces();

        return jsonResponse(interfaces);
    } catch (e: any) {
        console.error("[INTERFACES GET ERROR]:", e);
        return errorResponse(e.message || "Failed to fetch interfaces", 500);
    }
}
