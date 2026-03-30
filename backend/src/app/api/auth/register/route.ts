import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const email = body.email;
        const password = body.password;
        const fullName = body.fullName || body.name;
        const companyName = body.companyName || body.organization;
        const planId = body.planId || body.plan || "free_trial";
        const phone = body.phone || "";

        if (!email) return errorResponse("Email is required");
        if (!password) return errorResponse("Password is required");
        if (!companyName) return errorResponse("Company name is required");

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
            return errorResponse("User already exists with this email", 400);
        }

        // Check if we should skip registration flow for automation scripts ONLY
        const isAutomation = req.headers.get("x-automation-key") === process.env.AUTOMATION_KEY && process.env.AUTOMATION_KEY !== undefined;

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
                        status: "ACTIVE",
                        planId: actualPlanId,
                        trialStart,
                        trialEnd,
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
        if (!inputOtp) {
            return errorResponse("Verification Code (OTP) is explicitly required to create an account", 400);
        }

        // Strictly verify that the OTP was validated at Step 2
        const verifiedOtpMatch = await prisma.userOtp.findFirst({
            where: {
                email,
                otp: inputOtp,
                used: true, // Step 2 marked it as used
                expiresAt: { gt: new Date() }
            }
        });

        if (!verifiedOtpMatch) {
            return errorResponse("Invalid registration attempt. Please verify your OTP again.", 403);
        }

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
                    planId: actualPlanId,
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
        }, 201);
    } catch (e) {
        console.error("REGISTER ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
