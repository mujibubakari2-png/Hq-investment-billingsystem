import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { hashPassword, comparePassword, jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import logger from "@/lib/logger";

// GET /api/auth/profile - Get own profile
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "users:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const user = await db.user.findUnique({
            where:  { id: userPayload.userId },
            select: { id: true, username: true, email: true, role: true, phone: true, fullName: true },
        });

        if (!user) return errorResponse("User not found", 404);
        return jsonResponse(user);
    } catch (e) {
        logger.error("[profile] GET failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/auth/profile - Update own profile
export async function PUT(req: NextRequest) {
    try {
        const guard = requirePermission(req, "users:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const body = await req.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.fullName)              data.fullName = body.fullName;
        if (body.username)              data.username = body.username;
        if (body.email)                 data.email    = body.email;
        if (body.phone !== undefined)   data.phone    = body.phone;

        // Handle password change
        if (body.currentPassword && body.newPassword) {
            // MEDIUM-SEC FIX: Enforce minimum 8-character password server-side.
            // Frontend validation alone is insufficient — the API can be called directly.
            if (typeof body.newPassword !== "string" || body.newPassword.length < 8) {
                return errorResponse("New password must be at least 8 characters", 400);
            }

            const user = await db.user.findUnique({ where: { id: userPayload.userId } });
            if (!user) return errorResponse("User not found", 404);

            const isValid = await comparePassword(body.currentPassword, user.password);
            if (!isValid) return errorResponse("Current password is incorrect", 400);

            data.password = await hashPassword(body.newPassword);
        }

        const updated = await db.user.update({
            where:  { id: userPayload.userId },
            data,
            select: { id: true, username: true, email: true, role: true, phone: true, fullName: true },
        });

        return jsonResponse({ ...updated, message: "Profile updated successfully" });
    } catch (e) {
        logger.error("[profile] PUT failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
