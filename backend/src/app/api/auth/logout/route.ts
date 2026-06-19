import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { verifyRefreshToken, jsonResponse, errorResponse } from "@/lib/auth";
import { cacheSet } from "@/lib/cache";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    logger.request('POST', '/api/auth/logout');
    try {
        const refreshTokenStr = req.cookies.get('refreshToken')?.value;
        if (refreshTokenStr) {
            const payload = await verifyRefreshToken(refreshTokenStr);
            try {
                const decoded: any = jwt.decode(refreshTokenStr);
                if (decoded && decoded.jti && decoded.exp) {
                    const ttl = Math.max(1, decoded.exp - Math.floor(Date.now() / 1000));
                    await cacheSet(`revoked_refresh:${decoded.jti}`, true, ttl);
                }
            } catch (err) {
                // ignore
            }
        }

        const isProd = process.env.NODE_ENV === "production";
        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;

        const response = jsonResponse({ message: "Logged out" });
        // Clear cookies
        response.headers.append('Set-Cookie', `accessToken=deleted; ${cookieBase}; Max-Age=0`);
        response.headers.append('Set-Cookie', `refreshToken=deleted; ${cookieBase}; Max-Age=0`);

        return response;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Logout error', { error: message });
        return errorResponse('Internal server error', 500);
    }
}
