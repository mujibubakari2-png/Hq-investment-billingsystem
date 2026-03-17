import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

// GET /api/routers/[id]/pppoe — List PPPoE users
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const service = await getMikroTikService(id);
        const users = await service.listPPPoEUsers();
        return jsonResponse(users);
    } catch (err: any) {
        return errorResponse(err.message || "Failed to list PPPoE users", 500);
    }
}

// POST /api/routers/[id]/pppoe — Create PPPoE user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        if (!body.name || !body.password) {
            return errorResponse("Username and password are required");
        }

        const service = await getMikroTikService(id);
        const user = await service.createPPPoEUser({
            name: body.name,
            password: body.password,
            service: body.service || "pppoe",
            profile: body.profile || "default",
            disabled: body.disabled || false,
            comment: body.comment,
        });

        return jsonResponse(user, 201);
    } catch (err: any) {
        return errorResponse(err.message || "Failed to create PPPoE user", 500);
    }
}
