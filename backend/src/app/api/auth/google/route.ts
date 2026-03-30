import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, hashPassword, signToken } from "@/lib/auth";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "12345"); // Provide default to prevent crash if missing

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { credential, action } = body;

        if (!credential) return errorResponse("Google credential is required");

        let email: string;
        let fullName: string;

        // Skip actual validation if GOOGLE_CLIENT_ID is not set in dev, so users aren't fully blocked
        if (!process.env.GOOGLE_CLIENT_ID && process.env.NODE_ENV === "development") {
            // Unsafe mock mode if client ID doesn't exist
            // WARNING: In production without Client ID this fails. 
            const parts = credential.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                email = payload.email || "mock@google.com";
                fullName = payload.name || "Mock Google User";
            } else {
                return errorResponse("Invalid Google credential format");
            }
        } else {
            try {
                const ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID,
                });
                const payload = ticket.getPayload();
                if (!payload || !payload.email) return errorResponse("Invalid Google token");
                email = payload.email;
                fullName = payload.name || "Google User";
            } catch (err: any) {
                console.error("Google verify error:", err.message);
                return errorResponse("Token verification failed! Please check GOOGLE_CLIENT_ID.");
            }
        }

        let user = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username: email }]
            }
        });

        if (!user) {
            // Auto-Register flow for first-time Google sign-ins seamlessly

            let plan = await prisma.saasPlan.findFirst();
            if (!plan) return errorResponse("No SaaS plans available", 400);

            const companyName = `${fullName}'s Company`;
            const tempPassword = crypto.randomBytes(16).toString("hex");
            const hashedPassword = await hashPassword(tempPassword);

            const result = await prisma.$transaction(async (tx) => {
                const trialStart = new Date();
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 10);

                const tenant = await tx.tenant.create({
                    data: {
                        name: companyName,
                        email,
                        status: "ACTIVE", // Auto activate
                        planId: plan.id,
                        trialStart,
                        trialEnd,
                    }
                });

                const newUser = await tx.user.create({
                    data: {
                        fullName: fullName,
                        email,
                        username: email,
                        password: hashedPassword,
                        role: "SUPER_ADMIN",
                        status: "ACTIVE",
                        tenantId: tenant.id
                    }
                });

                return { user: newUser, tenant };
            });

            user = result.user;
        } else {
            if (user.status !== 'ACTIVE') {
                 return errorResponse("Account is not active", 403);
            }
        }

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
                tenantId: user.tenantId
            }
        }, 200);

    } catch (e) {
        console.error("GOOGLE AUTH ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
