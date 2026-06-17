import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";
import { requirePermission } from "@/lib/rbac";

// PUT /api/routers/[id]/hotspot/[userId] — Enable/Disable Hotspot user
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const { id, userId } = await params;
        const body = await req.json();

        const service = await getMikroTikService(id, userPayload.tenantId ?? null);
        await service.updateHotspotUser(userId, {
            disabled: body.disabled,
            password: body.password,
            profile: body.profile,
            name: body.name,
            macAddress: body.macAddress,
        });

        return jsonResponse({ message: "Hotspot user updated" });
    } catch (err: any) {
        return errorResponse("Failed to update Hotspot user", 500);
    }
}

// DELETE /api/routers/[id]/hotspot/[userId] — Delete Hotspot user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const { id, userId } = await params;
        const service = await getMikroTikService(id, userPayload.tenantId ?? null);
        await service.deleteHotspotUser(userId);
        return jsonResponse({ message: "Hotspot user deleted" });
    } catch (err: any) {
        return errorResponse("Failed to delete Hotspot user", 500);
    }
}
