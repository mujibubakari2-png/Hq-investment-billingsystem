import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { comparePassword, signToken, signRefreshToken, jsonResponse, errorResponse } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import logger from "@/lib/logger";

/**
 * POST /api/super-admin/auth/login
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * This endpoint is exclusively for Platform Super Admins (isPlatformAdmin users).
 * A user is a Platform Super Admin when:
 *   - role === "SUPER_ADMIN"  AND
 *   - tenantId === null (no tenant affiliation)
 *
 * Regular tenant SUPER_ADMINs (who have a tenantId) are explicitly rejected here.
 * They should use the normal /api/auth/login endpoint.
 * ──────────────────────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
    logger.request("POST", "/api/super-admin/auth/login");

    const rateLimitResponse = await checkRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        let body;
        try {
            body = await req.json();
        } catch {
            return errorResponse("Invalid JSON in request body", 400, "INVALID_JSON");
        }

        const { username, password, email } = body;
        const identifier = username || email;

        if (!identifier || !password) {
            return errorResponse("Username/email and password are required", 400, "MISSING_CREDENTIALS");
        }

        const db = getTenantClient(null);

        const user = await db.user.findFirst({
            where: {
                OR: [{ username: identifier }, { email: identifier }],
            },
        });

        if (!user) {
            // Constant-time delay to prevent username enumeration
            await comparePassword(password, "$2b$12$invalidhashplaceholderXXXXXXXXXXXX");
            return errorResponse("Invalid credentials", 401, "INVALID_CREDENTIALS");
        }

        // ── CRITICAL PRIVACY CHECK ────────────────────────────────────────────
        // Only allow users who are Platform Super Admins (no tenantId).
        // This prevents tenant-level SUPER_ADMINs from accessing the platform admin.
        if (user.role !== "SUPER_ADMIN" || user.tenantId !== null) {
            await comparePassword(password, "$2b$12$invalidhashplaceholderXXXXXXXXXXXX");
            return errorResponse("Access denied. This portal is for Platform Administrators only.", 403, "NOT_PLATFORM_ADMIN");
        }

        if (user.status !== "ACTIVE") {
            return errorResponse("Account is disabled", 403, "ACCOUNT_DISABLED");
        }

        const valid = await comparePassword(password, user.password);
        if (!valid) {
            return errorResponse("Invalid credentials", 401, "INVALID_CREDENTIALS");
        }

        // Update last login
        await db.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            tenantId: null, // Platform admins always have null tenantId
        };

        const token = signToken(payload);
        const refreshToken = signRefreshToken(payload);

        const isProd = process.env.NODE_ENV === "production";
        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;

        const response = jsonResponse({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                isPlatformAdmin: true,
            },
        });

        response.headers.append("Set-Cookie", `sa_accessToken=${token}; ${cookieBase}; Max-Age=7200`);
        response.headers.append("Set-Cookie", `sa_refreshToken=${refreshToken}; ${cookieBase}; Max-Age=604800`);

        logger.info("Platform Super Admin login", { userId: user.id, username: user.username });

        return response;
    } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        logger.error("Super Admin Login Error:", { error: err.message });
        return errorResponse("Internal server error", 500, "LOGIN_INTERNAL_ERROR",
            process.env.NODE_ENV === "production" ? undefined : err.message
        );
    }
}
