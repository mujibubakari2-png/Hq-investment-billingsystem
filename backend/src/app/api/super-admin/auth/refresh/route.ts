import { NextRequest } from "next/server";
import { verifyRefreshToken, signToken, signRefreshToken, errorResponse, jsonResponse } from "@/lib/auth";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";

/**
 * POST /api/super-admin/auth/refresh
 *
 * Refreshes the Super Admin access token using the sa_refreshToken cookie.
 * Strictly validates that the refreshed user is a platform admin (tenantId = null).
 */
export async function POST(req: NextRequest) {
    try {
        // Read the refresh token from cookie header
        const cookieHeader = req.headers.get("cookie") || "";
        const match = cookieHeader.match(/sa_refreshToken=([^;]+)/);
        const rawRefreshToken = match?.[1];

        if (!rawRefreshToken) {
            return errorResponse("No refresh token provided", 401, "NO_REFRESH_TOKEN");
        }

        let payload: Awaited<ReturnType<typeof verifyRefreshToken>>;
        payload = await verifyRefreshToken(rawRefreshToken);

        if (!payload) {
            return errorResponse("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
        }

        // Double-check the user is still a platform admin
        const db = getTenantClient(null);
        const user = await db.user.findUnique({ where: { id: payload.userId } });

        if (!user || user.role !== "SUPER_ADMIN" || user.tenantId !== null) {
            return errorResponse("Token refresh denied — not a platform admin", 403, "NOT_PLATFORM_ADMIN");
        }

        if (user.status !== "ACTIVE") {
            return errorResponse("Account is disabled", 403, "ACCOUNT_DISABLED");
        }

        const newPayload = { userId: user.id, username: user.username, role: user.role, tenantId: null };
        const newAccessToken = signToken(newPayload);
        const newRefreshToken = signRefreshToken(newPayload);

        const isProd = process.env.NODE_ENV === "production";
        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;

        const response = jsonResponse({ token: newAccessToken });
        response.headers.append("Set-Cookie", `sa_accessToken=${newAccessToken}; ${cookieBase}; Max-Age=7200`);
        response.headers.append("Set-Cookie", `sa_refreshToken=${newRefreshToken}; ${cookieBase}; Max-Age=604800`);

        return response;
    } catch (e) {
        logger.error("Super Admin Token Refresh Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
