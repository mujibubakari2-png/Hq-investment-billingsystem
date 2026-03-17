import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { fullName, email, phone, password, companyName, planId } = await req.json();

        if (!email || !password || !companyName || !planId) {
            return errorResponse("Missing required fields: email, password, companyName, planId");
        }

        // Verify if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return errorResponse("User already exists with this email", 400);
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Run user and tenant creation inside a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Calculate trial dates (10 days)
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 10);

            // 2. Create the Tenant
            const tenant = await tx.tenant.create({
                data: {
                    name: companyName,
                    email,
                    phone,
                    status: "TRIALLING",
                    planId,
                    trialStart,
                    trialEnd,
                }
            });

            // 3. Create the User assigned to the Tenant
            const newUser = await tx.user.create({
                data: {
                    fullName: fullName || companyName,
                    email,
                    username: email, // use email as username for login
                    phone,
                    password: hashedPassword,
                    role: "SUPER_ADMIN",
                    status: "ACTIVE",
                    tenantId: tenant.id
                }
            });

            return { user: newUser, tenant };
        });

        const token = signToken({
            userId: result.user.id,
            username: result.user.username,
            role: result.user.role,
            tenantId: result.tenant.id,
        });

        return jsonResponse({
            message: "Registration successful. Welcome to your 10-day trial!",
            token,
            user: {
                id: result.user.id,
                username: result.user.username,
                email: result.user.email,
                role: result.user.role,
                fullName: result.user.fullName,
                tenantId: result.tenant.id
            },
            tenant: result.tenant
        });
    } catch (e) {
        console.error("REGISTER ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
