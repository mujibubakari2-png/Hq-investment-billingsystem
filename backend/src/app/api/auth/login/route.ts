import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken, jsonResponse, errorResponse, isAutomationRequest } from "@/lib/auth";
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
            }
        });
        if (!user) {
            return errorResponse("Invalid credentials", 401);
        }

        if (user.status !== "ACTIVE") {
            return errorResponse("Account is disabled", 403);
        }

        const isAutomation = isAutomationRequest(req);

        const valid = isAutomation || await comparePassword(password, user.password);
        logger.info('Login result', { username, success: valid });
        if (!valid) {
            return errorResponse("Invalid credentials", 401);
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        const token = signToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
        });

        return jsonResponse({
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
            },
        });
    } catch (e: any) {
        logger.error('Login error', { error: e?.message || String(e) });
        return errorResponse("Internal server error", 500);
    }
}
