import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, hashPassword, signToken } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    // Rate limit: 20 Google auth attempts per 15 minutes per IP
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ip, "google-auth", { limit: 20, windowSeconds: 15 * 60 });
    if (!rateLimit.allowed) {
        return errorResponse(
            `Too many requests. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
            429
        );
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const isProduction = process.env.NODE_ENV === "production";

    // In production, refuse to run without a real Google Client ID
    if (isProduction && !googleClientId) {
        console.error("[GOOGLE AUTH] GOOGLE_CLIENT_ID is not set in production!");
        return errorResponse("Google login is not configured on this server.", 503);
    }

    const client = new OAuth2Client(googleClientId || "");

    try {
        const body = await req.json();
        const { credential } = body;

        if (!credential) return errorResponse("Google credential is required");

        let email: string;
        let fullName: string;

        if (!googleClientId && !isProduction) {
            // Dev mock mode — decode the JWT without verification.
            // WARNING: Never runs in production (blocked above).
            const parts = credential.split(".");
            if (parts.length === 3) {
                try {
                    const payload = JSON.parse(
                        Buffer.from(parts[1], "base64url").toString("utf8")
                    );
                    email = payload.email || "mock@google.com";
                    fullName = payload.name || "Mock Google User";
                } catch {
                    return errorResponse("Invalid Google credential format in mock mode");
                }
            } else {
                return errorResponse("Invalid Google credential format");
            }
        } else {
            // Production / configured dev: full token verification
            try {
                const ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: googleClientId,
                });
                const payload = ticket.getPayload();
                if (!payload || !payload.email) return errorResponse("Invalid Google token payload");
                email = payload.email;
                fullName = payload.name || "Google User";
            } catch (err: any) {
                console.error("[GOOGLE AUTH] Token verification failed:", err.message);
                return errorResponse(
                    "Google token verification failed. Ensure the correct Google Client ID is configured.",
                    401
                );
            }
        }

        // Look up existing user by email or username
        let user = await prisma.user.findFirst({
            where: { OR: [{ email }, { username: email }] }
        });

        if (!user) {
            // First-time Google sign-in → auto-register as a new tenant ADMIN
            // (not SUPER_ADMIN — that must be set manually in the database)
            const plan = await prisma.saasPlan.findFirst();
            if (!plan) return errorResponse("No SaaS plans available. Contact support.", 400);

            const companyName = `${fullName}'s Company`;
            const tempPassword = crypto.randomBytes(32).toString("hex");
            const hashedPassword = await hashPassword(tempPassword);

            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + 10);

            const result = await prisma.$transaction(async (tx) => {
                const tenant = await tx.tenant.create({
                    data: {
                        name: companyName,
                        email,
                        // New registrations start PENDING_APPROVAL — SuperAdmin activates them
                        status: "PENDING_APPROVAL",
                        planId: plan.id,
                        trialStart: now,
                        trialEnd,
                    },
                });

                const newUser = await tx.user.create({
                    data: {
                        fullName,
                        email,
                        username: email,
                        password: hashedPassword,
                        // ADMIN of their own tenant — never SUPER_ADMIN via self-registration
                        role: "ADMIN",
                        status: "ACTIVE",
                        tenantId: tenant.id,
                    },
                });

                return { user: newUser, tenant };
            });

            user = result.user;
        } else {
            if (user.status !== "ACTIVE") {
                return errorResponse("Account is disabled. Contact support.", 403);
            }
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
            message: "Authentication successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                tenantId: user.tenantId,
            },
        }, 200);
    } catch (e) {
        console.error("[GOOGLE AUTH] Unexpected error:", e);
        return errorResponse("Internal server error", 500);
    }
}
