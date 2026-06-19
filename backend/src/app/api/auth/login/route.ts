import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { comparePassword, signToken, signRefreshToken, jsonResponse, errorResponse } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import { getTenantClient } from "@/lib/tenantPrisma";
import logger from "@/lib/logger";
import { cacheGet, cacheSet, invalidateTenant } from "@/lib/cache";

// ── CRIT-002 FIX: MFA temp-token ──────────────────────────────────────────────
// If a user has MFA enabled, we issue a short-lived (5 min) "pending" token
// instead of the real access token. The frontend submits this + TOTP code to
// /api/auth/mfa/verify, which then issues the real cookies.
// The temp token uses a derived secret — it cannot be used to access any
// protected route (verifyToken() checks the full JWT_ACCESS_SECRET + aud/iss).

const TEMP_TOKEN_TTL = 5 * 60; // 5 minutes in seconds

function issueMfaTempToken(userId: string): string {
    const secret =
        (process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? "") + "_mfa_pending";
    return jwt.sign({ userId, purpose: "mfa_pending" }, secret, {
        expiresIn: TEMP_TOKEN_TTL,
    });
}

export async function GET() {
    return jsonResponse({ message: "Login endpoint is reachable. Please use POST to authenticate." });
}

export async function POST(req: NextRequest) {
    logger.request("POST", "/api/auth/login");

    // Rate limit: returns a 429 NextResponse if exceeded, null if OK
    const rateLimitResponse = await checkRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        let body;
        try {
            body = await req.json();
        } catch {
            return errorResponse("Invalid JSON in request body", 400);
        }

        const username = body.username || body.email;
        const password = body.password;

        logger.info("Login attempt", { username });

        if (!username || !password) {
            return errorResponse("Username and password are required");
        }

        const db = getTenantClient(null);
        const user = await db.user.findFirst({
            where: {
                OR: [{ username }, { email: username }],
            },
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true,
                        email: true,
                        branding: {
                            select: {
                                companyName: true,
                                companyLogo: true,
                                companyEmail: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            // CRIT-007: Constant-time delay to prevent username enumeration via timing
            await comparePassword(password, "$2b$12$invalidhashplaceholderXXXXXXXXXXXX");
            return errorResponse("Invalid credentials", 401);
        }

        // Account lockout check (defense-in-depth)
        const LOCKOUT_THRESHOLD = Number(process.env.LOCKOUT_THRESHOLD ?? 5);
        const LOCKOUT_DURATION = Number(process.env.LOCKOUT_DURATION_SEC ?? 15 * 60); // seconds
        const failedKey = `failed_login:${user.email}`;
        const lockoutKey = `lockout:${user.email}`;
        try {
            const locked = await cacheGet<boolean>(lockoutKey);
            if (locked) return errorResponse("Account temporarily locked due to multiple failed login attempts", 403);
        } catch (err) {
            // cache errors are non-fatal
        }

        if (user.status !== "ACTIVE") {
            return errorResponse("Account is disabled", 403);
        }

        const valid = await comparePassword(password, user.password);
        logger.info("Login result", { username, success: valid });
        if (!valid) {
            // Increment failed attempts counter
            try {
                const prev = (await cacheGet<number>(failedKey)) ?? 0;
                const nowCount = prev + 1;
                await cacheSet(failedKey, nowCount, Number(process.env.LOCKOUT_WINDOW_SEC ?? 15 * 60));
                if (nowCount >= LOCKOUT_THRESHOLD) {
                    await cacheSet(lockoutKey, true, LOCKOUT_DURATION);
                }
            } catch (err) {
                // ignore cache errors
            }
            return errorResponse("Invalid credentials", 401);
        }

        // ── CRIT-002 FIX: MFA challenge ───────────────────────────────────────
        // If user has MFA enabled, do NOT issue real tokens yet.
        // Return a short-lived temp token; client must complete /api/auth/mfa/verify.
        if (user.mfaEnabled) {
            logger.info("MFA challenge issued", { username });
            const tempToken = issueMfaTempToken(user.id);
            // Reset failed attempts on successful password validation
            try { await cacheSet(failedKey, 0, 60); } catch { }
            return jsonResponse({
                mfaRequired: true,
                tempToken,
                message: "MFA verification required. Submit your 6-digit code.",
            });
        }

        // ── Standard login (MFA not enabled) ─────────────────────────────────
        await db.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
        };
        const token = signToken(payload);
        const refreshToken = signRefreshToken(payload);
        // Reset failed attempts on successful login
        try { await cacheSet(failedKey, 0, 60); } catch { }

        const response = jsonResponse({
            token,
            id: user.id,       // Alias for tests
            user_id: user.id,  // Alias for tests
            tenant_id: user.tenantId, // Alias for tests
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                phone: user.phone,
                tenantId: user.tenantId,
                tenant_id: user.tenantId,
                isPlatformAdmin: user.role === "SUPER_ADMIN" && !user.tenantId,
                companyName: user.tenant?.branding?.companyName || user.tenant?.name,
                companyLogo: user.tenant?.branding?.companyLogo || user.tenant?.logoUrl,
                companyEmail: user.tenant?.branding?.companyEmail || user.tenant?.email,
                tenantSlug: user.tenant?.slug,
            },
        });

        // HIGH-001 FIX: Always use SameSite=Strict in production (was conditionally Lax/None)
        const isProd = process.env.NODE_ENV === "production";
        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;
        response.headers.append("Set-Cookie", `accessToken=${token}; ${cookieBase}; Max-Age=7200`);
        response.headers.append("Set-Cookie", `refreshToken=${refreshToken}; ${cookieBase}; Max-Age=604800`);

        return response;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error("Login error", { error: message });
        return errorResponse("Internal server error", 500);
    }
}
