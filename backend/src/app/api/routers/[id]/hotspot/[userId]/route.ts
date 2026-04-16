import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// PUT /api/routers/[id]/hotspot/[userId] — Enable/Disable Hotspot user
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id, userId } = await params;
        const body = await req.json();

        const service = await getMikroTikService(id, userPayload.tenantId);
        await service.updateHotspotUser(userId, {
            disabled: body.disabled,
            password: body.password,
            profile: body.profile,
            name: body.name,
            macAddress: body.macAddress,
        });

        return jsonResponse({ message: "Hotspot user updated" });
    } catch (err: any) {
        return errorResponse(err.message || "Failed to update Hotspot user", 500);
    }
}

// DELETE /api/routers/[id]/hotspot/[userId] — Delete Hotspot user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id, userId } = await params;
        const service = await getMikroTikService(id, userPayload.tenantId);
        await service.deleteHotspotUser(userId);
        return jsonResponse({ message: "Hotspot user deleted" });
    } catch (err: any) {
        return errorResponse(err.message || "Failed to delete Hotspot user", 500);
    }
}
