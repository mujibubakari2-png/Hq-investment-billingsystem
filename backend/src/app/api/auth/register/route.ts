import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, hashPassword, signToken, isAutomationRequest } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";
import { sendAccountCreatedNotifications } from "@/lib/accountNotifications";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
    // Rate limit: 10 registrations per 30 minutes per IP
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(ip, "register", { limit: 10, windowSeconds: 30 * 60 });
    if (!rateLimit.allowed) {
        return errorResponse(
            `Too many registration attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
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

        const email = body.email;
        const password = body.password;
        const fullName = body.fullName || body.name || email?.split('@')[0] || "New User";
        const companyName = body.tenantName || body.companyName || body.organization || `${fullName}'s Organization`;
        const planId = body.planId || body.plan || "free_trial";
        const phone = body.phone || "";

        if (!email) return errorResponse("Email is required");
        if (!password) return errorResponse("Password is required");

        // Verify if plan exists, or use default if it's a test string
        let plan = await prisma.saasPlan.findUnique({ where: { id: planId } });

        if (!plan && (planId === "basic" || planId === "standard" || planId === "premium")) {
            // Map simple strings to seeded IDs
            const mappedId = `plan_${planId}`;
            plan = await prisma.saasPlan.findUnique({ where: { id: mappedId } });
        }

        // Default to standard if not found
        if (!plan) {
            plan = await prisma.saasPlan.findFirst();
        }

        // If STILL no plan (empty DB), create a default one for the flow to continue
        if (!plan) {
            plan = await prisma.saasPlan.create({
                data: {
                    id: "free_trial",
                    name: "10-Day Free Trial",
                    price: 0,
                    clientLimit: 10
                }
            });
        }

        if (!plan) {
            return errorResponse("No SaaS plans available", 400);
        }

        const actualPlanId = plan.id;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse("Invalid email format");
        }

        // Validate password length
        if (password.length < 6) {
            return errorResponse("Password must be at least 6 characters long", 400);
        }

        // Verify if email already exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username: email }
                ]
            }
        });
        if (existingUser) {
            return errorResponse("User already exists with this email", 409);
        }

        // Automation bypass for CI/test tooling in development/test environments only.
        const isAutomation = isAutomationRequest(req);

        if (isAutomation) {
            const hashedPassword = await hashPassword(password);
            const result = await prisma.$transaction(async (tx) => {
                const trialStart = new Date();
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 10);

                const tenant = await tx.tenant.create({
                    data: {
                        name: companyName,
                        email,
                        phone,
                        status: "PENDING_APPROVAL",
                        planId: actualPlanId,
                        // trialStart and trialEnd will be populated by the SuperAdmin upon approval
                    }
                });

                const newUser = await tx.user.create({
                    data: {
                        fullName: fullName || companyName,
                        email,
                        username: email,
                        phone,
                        password: hashedPassword,
                        role: "ADMIN",
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
                message: "User registered successfully (Automation)",
                token,
                id: result.user.id, // Alias for tests
                user_id: result.user.id, // Alias for tests
                tenant_id: result.tenant.id, // Alias for tests
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    email: result.user.email,
                    role: result.user.role,
                    fullName: result.user.fullName,
                    tenantId: result.tenant.id
                },
                tenant: result.tenant
            }, 201);
        }

        const inputOtp = body.otp;
        const isProd = env.NODE_ENV === "production";
        if (!inputOtp && isProd) {
            return errorResponse("Verification Code (OTP) is explicitly required to create an account", 400);
        }

        // Strictly verify that the OTP was validated at Step 2
        if (inputOtp || isProd) {
            const verifiedOtpMatch = await prisma.userOtp.findFirst({
                where: {
                    email,
                    otp: inputOtp || "NOT_PROVIDED",
                    used: true, // Step 2 marked it as used
                    expiresAt: { gt: new Date() }
                }
            });

            if (!verifiedOtpMatch) {
                return errorResponse("Invalid registration attempt. Please verify your OTP again.", 403);
            }
        }

        const hashedPassword = await hashPassword(password);

        // Run user and tenant creation inside a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Calculate trial dates (10 days)
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 10);

            // 2. Create the Tenant (Status PENDING_APPROVAL)
            const tenant = await tx.tenant.create({
                data: {
                    name: companyName,
                    email,
                    phone,
                    status: "PENDING_APPROVAL",
                    planId: actualPlanId,
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
                    role: "ADMIN",
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

        await sendAccountCreatedNotifications({
            tenantId: result.tenant.id,
            tenantName: result.tenant.name,
            email: result.tenant.email,
            phone: result.tenant.phone,
        });

        return jsonResponse({
            message: "Registration successful. Please wait for an administrator to approve your account setup.",
            token,
            id: result.user.id, // Alias for tests
            user_id: result.user.id, // Alias for tests
            tenant_id: result.tenant.id, // Alias for tests
            user: {
                id: result.user.id,
                username: result.user.username,
                email: result.user.email,
                role: result.user.role,
                fullName: result.user.fullName,
                tenantId: result.tenant.id
            },
            tenant: result.tenant
        }, 201);
    } catch (e) {
        console.error("REGISTER ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
