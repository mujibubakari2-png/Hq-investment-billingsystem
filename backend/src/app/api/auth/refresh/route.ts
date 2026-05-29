import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken, verifyToken, jsonResponse, errorResponse } from "@/lib/auth";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    logger.request('POST', '/api/auth/refresh');

    try {
        const refreshTokenStr = req.cookies.get('refreshToken')?.value;
        if (!refreshTokenStr) {
            return errorResponse("No refresh token provided", 401);
        }

        const payload = verifyToken(refreshTokenStr);
        if (!payload) {
            return errorResponse("Invalid or expired refresh token", 401);
        }

        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
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

        const response = jsonResponse({
            token,
            user: newPayload
        });

        const isSecure = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
        const sameSiteStr = isSecure ? 'None; Secure' : 'Lax';
        response.headers.append('Set-Cookie', `accessToken=${token}; Path=/; HttpOnly; SameSite=${sameSiteStr}; Max-Age=1800`);

        return response;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Refresh token error', { error: message });
        return errorResponse("Internal server error", 500);
    }
}
