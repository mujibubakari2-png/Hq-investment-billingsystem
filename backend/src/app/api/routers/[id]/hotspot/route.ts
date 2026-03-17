import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/routers/[id]/hotspot — List Hotspot users
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const service = await getMikroTikService(id);
        const users = await service.listHotspotUsers();
        return jsonResponse(users);
    } catch (err: any) {
        return errorResponse(err.message || "Failed to list Hotspot users", 500);
    }
}

// POST /api/routers/[id]/hotspot — Create Hotspot user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        if (!body.name || !body.password) {
            return errorResponse("Username and password are required");
        }

        const service = await getMikroTikService(id);
        const user = await service.createHotspotUser({
            name: body.name,
            password: body.password,
            profile: body.profile || "default",
            server: body.server || "all",
            disabled: body.disabled || false,
            comment: body.comment,
            macAddress: body.macAddress,
            limitUptime: body.limitUptime,
            limitBytesTotal: body.limitBytesTotal,
        });

        return jsonResponse(user, 201);
    } catch (err: any) {
        return errorResponse(err.message || "Failed to create Hotspot user", 500);
    }
}
