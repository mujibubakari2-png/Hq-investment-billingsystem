import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";

/**
 * GET /api/super-admin/auth/me
 *
 * Returns the currently authenticated Platform Super Admin's profile.
 * ── PRIVACY BOUNDARY: Rejects any user with a tenantId. ──────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        // CRITICAL: Reject tenant-level admins
        if (userPayload.tenantId) {
            return errorResponse("Access denied. This portal is for Platform Administrators only.", 403, "NOT_PLATFORM_ADMIN");
        }

        const db = getTenantClient(null);
        const user = await db.user.findUnique({
            where: { id: userPayload.userId },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                role: true,
                status: true,
                lastLogin: true,
                createdAt: true,
            },
        });

        if (!user) return errorResponse("User not found", 404);

        return jsonResponse({
            ...user,
            isPlatformAdmin: true,
        });
    } catch (e) {
        logger.error("Super Admin /me Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
