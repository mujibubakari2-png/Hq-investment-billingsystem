import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// PUT /api/routers/[id]/pppoe/[userId] — Enable/Disable PPPoE user
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
    try {
        const { id, userId } = await params;
        const body = await req.json();

        const service = await getMikroTikService(id);
        await service.updatePPPoEUser(userId, {
            disabled: body.disabled,
            password: body.password,
            profile: body.profile,
            name: body.name,
        });

        return jsonResponse({ message: "PPPoE user updated" });
    } catch (err: any) {
        return errorResponse(err.message || "Failed to update PPPoE user", 500);
    }
}

// DELETE /api/routers/[id]/pppoe/[userId] — Delete PPPoE user
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
    try {
        const { id, userId } = await params;
        const service = await getMikroTikService(id);
        await service.deletePPPoEUser(userId);
        return jsonResponse({ message: "PPPoE user deleted" });
    } catch (err: any) {
        return errorResponse(err.message || "Failed to delete PPPoE user", 500);
    }
}
