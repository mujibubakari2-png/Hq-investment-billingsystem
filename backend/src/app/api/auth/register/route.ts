import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse, hashPassword, signToken, signRefreshToken } from "@/lib/auth";
import { AuthRegisterSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rateLimiter";
import logger from "@/lib/logger";
import { sendAccountCreatedNotifications } from "@/lib/accountNotifications";
import { env } from "@/lib/env";
import { createUniqueTenantSlug } from "@/lib/tenantSlug";

export async function POST(req: NextRequest) {
    const rateLimitResponse = await checkRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;

    const db = getTenantClient(null);

    try {
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return errorResponse("Invalid JSON in request body", 400);
        }

        const parsed = AuthRegisterSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }

        const email = parsed.data.email;
        const password = parsed.data.password;
        const fullName = parsed.data.fullName || body.name || email?.split('@')[0] || "New User";
        const companyName = body.tenantName || body.companyName || body.organization || `${fullName}'s Organization`;
        const planId = body.planId || body.plan || "free_trial";
        const phone = body.phone || "";

        // Verify if plan exists, or use default if it's a test string
        let plan = await db.saasPlan.findUnique({ where: { id: planId } });

        if (!plan && (planId === "basic" || planId === "standard" || planId === "premium")) {
            // Map simple strings to seeded IDs
            const mappedId = `plan_${planId}`;
            plan = await db.saasPlan.findUnique({ where: { id: mappedId } });
        }

        // Default to standard if not found
        if (!plan) {
            plan = await db.saasPlan.findFirst();
        }

        // If STILL no plan (empty DB), create a default one for the flow to continue
        if (!plan) {
            plan = await db.saasPlan.create({
                data: {
                    id: "free_trial",
                    name: "10-Day Free Trial",
                    price: 0,
                    pppoeLimit: 10,
                    hotspotLimit: null
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
        const existingUser = await db.user.findFirst({
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


        const inputOtp = body.otp;
        const isProd = env.NODE_ENV === "production";
        if (!inputOtp && isProd) {
            return errorResponse("Verification Code (OTP) is explicitly required to create an account", 400);
        }

        // Strictly verify that the OTP was validated at Step 2
        if (inputOtp || isProd) {
            const verifiedOtpMatch = await db.userOtp.findFirst({
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
        const result = await db.$transaction(async (tx) => {
            // 1. Calculate trial dates (10 days)
            const trialStart = new Date();
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 10);
            const slug = await createUniqueTenantSlug(tx, companyName);
            const companyLogo = body.companyLogo || body.logoUrl || null;

            // 2. Create the Tenant. The account creator is now the tenant owner.
            const tenant = await tx.tenant.create({
                data: {
                    name: companyName,
                    email,
                    phone,
                    slug,
                    logoUrl: companyLogo,
                    status: "TRIALLING",
                    planId: actualPlanId,
                    trialStart,
                    trialEnd,
                    branding: {
                        create: {
                            companyName,
                            companyLogo,
                            companyEmail: email,
                        },
                    },
                    settings: {
                        create: {},
                    },
                }
            });

            // 3. Create the owner user assigned to the Tenant
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

            const ownedTenant = await tx.tenant.update({
                where: { id: tenant.id },
                data: {
                    ownerUserId: newUser.id,
                    tenantLicenses: {
                        create: {
                            planId: actualPlanId,
                            status: "PAID",
                            startsAt: trialStart,
                            expiresAt: trialEnd,
                        },
                    },
                },
            });

            return { user: newUser, tenant: ownedTenant };
        });

        const payload = {
            userId: result.user.id,
            username: result.user.username,
            role: result.user.role,
            tenantId: result.tenant.id,
        };
        const token = signToken(payload);
        const refreshToken = signRefreshToken(payload);

        await sendAccountCreatedNotifications({
            tenantId: result.tenant.id,
            tenantName: result.tenant.name,
            email: result.tenant.email,
            phone: result.tenant.phone,
        });


        const response = jsonResponse({
            message: "Registration successful. Your tenant workspace is ready.",
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
                tenantId: result.tenant.id,
                isPlatformAdmin: false,
                companyName: result.tenant.name,
                companyLogo: result.tenant.logoUrl,
                companyEmail: result.tenant.email,
                tenantSlug: result.tenant.slug,
            },
            tenant: result.tenant
        }, 201);

        const secureFlag = isProd ? "Secure; " : "";
        const sameSite = isProd ? "Strict" : "Lax";
        const cookieBase = `Path=/; HttpOnly; ${secureFlag}SameSite=${sameSite}`;
        response.headers.append('Set-Cookie', `accessToken=${token}; ${cookieBase}; Max-Age=1800`);
        response.headers.append('Set-Cookie', `refreshToken=${refreshToken}; ${cookieBase}; Max-Age=604800`);

        return response;
    } catch (e) {
        logger.error('Register error', { error: (e as Error)?.message || String(e) });
        return errorResponse("Internal server error", 500);
    }
}
