import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { requireAuth, hashPassword, comparePassword, jsonResponse, errorResponse } from "@/lib/auth";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    logger.request('POST', '/api/auth/profile/change-password');

    let payload;
    try {
        payload = requireAuth(req);
    } catch (e) {
        return errorResponse("Unauthorized", 401);
    }

    try {
        const db = getTenantClient(payload);
        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return errorResponse("Both current password and new password are required");
        }

        const user = await db.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            return errorResponse("User not found", 404);
        }

        const isValid = await comparePassword(currentPassword, user.password);
        if (!isValid) {
            return errorResponse("Incorrect current password", 401);
        }

        const hashedNewPassword = await hashPassword(newPassword);

        await db.user.update({
            where: { id: payload.userId },
            data: { password: hashedNewPassword }
        });

        logger.info('Password changed', { userId: payload.userId });

        return jsonResponse({ message: "Password updated successfully" });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Password change error', { error: message });
        return errorResponse("Internal server error", 500);
    }
}

