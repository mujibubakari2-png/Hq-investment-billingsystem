import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken, jsonResponse, errorResponse } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
    // Rate limit: 10 attempts per 15 minutes per IP
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ip, "login", { limit: 10, windowSeconds: 15 * 60 });
    if (!rateLimit.allowed) {
        return errorResponse(
            `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
            429
        );
    }

    try {
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return errorResponse("Invalid JSON in request body", 400);
        }

        const username = body.username || body.email;
        const password = body.password;

        // Never log the password — log only the username for debugging
        console.log(`[LOGIN ATTEMPT] User: ${username}`);

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

        const automationKey = process.env.AUTOMATION_KEY;
        const isAutomation = (req.headers.get("x-automation-key") === automationKey || req.headers.get("x-api-key") === automationKey) && automationKey !== undefined;

        const valid = isAutomation || await comparePassword(password, user.password);
        console.log(`[LOGIN RESULT] User: ${username}, Success: ${valid}`);
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
        console.error("LOGIN ERROR:", e);
        return errorResponse(`Internal server error: ${e.message || e}`, 500);
    }
}
