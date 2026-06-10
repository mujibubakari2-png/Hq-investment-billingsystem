import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken, signRefreshToken, jsonResponse, errorResponse } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import logger from "@/lib/logger";

export async function GET() {
    return jsonResponse({ message: "Login endpoint is reachable. Please use POST to authenticate." });
}

export async function POST(req: NextRequest) {
    logger.request('POST', '/api/auth/login');

    // Rate limit: returns a 429 NextResponse if exceeded, null if OK
    const rateLimitResponse = await checkRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return errorResponse("Invalid JSON in request body", 400);
        }

        const username = body.username || body.email;
        const password = body.password;

        logger.info('Login attempt', { username });

        if (!username || !password) {
            return errorResponse("Username and password are required");
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email: username }
                ]
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
            return errorResponse("Invalid credentials", 401);
        }

        if (user.status !== "ACTIVE") {
            return errorResponse("Account is disabled", 403);
        }

        const valid = await comparePassword(password, user.password);
        logger.info('Login result', { username, success: valid });
        if (!valid) {
            return errorResponse("Invalid credentials", 401);
        }

        // Update last login
        await prisma.user.update({
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

        const response = jsonResponse({
            token,
            id: user.id, // Alias for tests
            user_id: user.id, // Alias for tests
            tenant_id: user.tenantId, // Alias for tests
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                phone: user.phone,
                tenantId: user.tenantId,
                tenant_id: user.tenantId, // Alias for tests
                isPlatformAdmin: user.role === "SUPER_ADMIN" && !user.tenantId,
                companyName: user.tenant?.branding?.companyName || user.tenant?.name,
                companyLogo: user.tenant?.branding?.companyLogo || user.tenant?.logoUrl,
                companyEmail: user.tenant?.branding?.companyEmail || user.tenant?.email,
                tenantSlug: user.tenant?.slug,
            },
        });

        const isSecure = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
        const sameSiteStr = isSecure ? 'None; Secure' : 'Lax';
        response.headers.append('Set-Cookie', `accessToken=${token}; Path=/; HttpOnly; SameSite=${sameSiteStr}; Max-Age=1800`);
        response.headers.append('Set-Cookie', `refreshToken=${refreshToken}; Path=/; HttpOnly; SameSite=${sameSiteStr}; Max-Age=604800`);

        return response;
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logger.error('Login error', { error: message });
        return errorResponse("Internal server error", 500);
    }
}
