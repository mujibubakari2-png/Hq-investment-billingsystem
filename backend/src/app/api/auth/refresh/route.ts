import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { signToken, verifyRefreshToken, jsonResponse, errorResponse } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { cacheSet } from "@/lib/cache";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    logger.request('POST', '/api/auth/refresh');

    try {
        const refreshTokenStr = req.cookies.get('refreshToken')?.value;
        if (!refreshTokenStr) {
            return errorResponse("No refresh token provided", 401);
        }

        const payload = await verifyRefreshToken(refreshTokenStr);
        if (!payload) {
            return errorResponse("Invalid or expired refresh token", 401);
        }

        const db = getTenantClient(payload);
        const user = await db.user.findUnique({ where: { id: payload.userId } });
        if (!user || user.status !== "ACTIVE") {
            return errorResponse("User not found or disabled", 401);
        }

        const newPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
        };
        const token = signToken(newPayload);
        // Rotate refresh token: issue a new refresh token and revoke the old one
        const newRefreshToken = (await import("@/lib/auth")).signRefreshToken(newPayload);

        // Revoke old refresh token jti so it cannot be reused
        try {
            const decoded: any = jwt.decode(refreshTokenStr);
            if (decoded && decoded.jti && decoded.exp) {
                const ttl = Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
                await cacheSet(`revoked_refresh:${decoded.jti}`, true, ttl);
            }
        } catch (err) {
            // Non-fatal — log upstream
        }

        const response = jsonResponse({
            token,
            user: newPayload
        });

        const isProd = process.env.NODE_ENV === "production";
        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;
        response.headers.append('Set-Cookie', `accessToken=${token}; ${cookieBase}; Max-Age=7200`);
        // Set rotated refresh token cookie
        response.headers.append('Set-Cookie', `refreshToken=${newRefreshToken}; ${cookieBase}; Max-Age=604800`);

        return response;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Refresh token error', { error: message });
        return errorResponse("Internal server error", 500);
    }
}
