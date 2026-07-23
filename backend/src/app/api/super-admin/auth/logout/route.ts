import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";

/**
 * POST /api/super-admin/auth/logout
 *
 * Clears the super-admin session cookies and logs the logout event.
 */
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_ADMIN_LOGOUT",
            resource: "Auth",
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        const isProd = process.env.NODE_ENV === "production";
        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;

        const response = jsonResponse({ message: "Logged out successfully" });
        // Clear the super-admin cookies
        response.headers.append("Set-Cookie", `sa_accessToken=; ${cookieBase}; Max-Age=0`);
        response.headers.append("Set-Cookie", `sa_refreshToken=; ${cookieBase}; Max-Age=0`);

        logger.info("Platform Super Admin logged out", { userId: guard.user.userId });
        return response;
    } catch (e) {
        logger.error("Super Admin Logout Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
