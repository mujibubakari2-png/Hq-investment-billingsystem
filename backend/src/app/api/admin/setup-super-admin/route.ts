import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";
import logger from "@/lib/logger";


export async function GET(req: NextRequest) {
    try {
        const rateLimitResponse = await checkRateLimit(req);
        if (rateLimitResponse) return rateLimitResponse;

        // Never expose this endpoint in production
        if (process.env.NODE_ENV === "production") {
            return errorResponse("Not found", 404);
        }

        const setupEnabled = process.env.ENABLE_SUPER_ADMIN_SETUP === "true";
        const setupKey = process.env.SUPER_ADMIN_SETUP_KEY;
        const providedKey = req.headers.get("x-setup-key");
        if (!setupEnabled || !setupKey || providedKey !== setupKey) {
            return errorResponse("Not found", 404);
        }

        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (!superAdminEmail || !superAdminPassword) {
            return errorResponse("Server setup is incomplete", 500);
        }

        const db = getTenantClient(null);
        const hashedPassword = await hashPassword(superAdminPassword);

        logger.info("Setting up unique Super Admin account...");

        // 1. Check if the account already exists
        const existing = await db.user.findUnique({
            where: { email: superAdminEmail }
        });

        if (existing) {
            // Update to Super Admin role
            await db.user.update({
                where: { id: existing.id },
                data: {
                    role: "SUPER_ADMIN",
                    password: hashedPassword,
                    tenantId: null // Ensure global access
                }
            });
            logger.info(`Updated existing account: ${superAdminEmail}`);
        } else {
            // Create new Super Admin account
            await db.user.create({
                data: {
                    username: "superadmin",
                    email: superAdminEmail,
                    password: hashedPassword,
                    fullName: "Platform Super Admin",
                    role: "SUPER_ADMIN",
                    status: "ACTIVE",
                    tenantId: null
                }
            });
            logger.info(`Created new Super Admin account: ${superAdminEmail}`);
        }

        // 2. Demote all other users with SUPER_ADMIN to ADMIN
        const others = await db.user.updateMany({
            where: {
                email: { not: superAdminEmail },
                role: "SUPER_ADMIN"
            },
            data: {
                role: "ADMIN"
            }
        });

        return jsonResponse({
            message: "Super Admin setup complete.",
            superAdmin: superAdminEmail,
            demotedCount: others.count
        });

    } catch (error: any) {
        logger.error("Error setting up super admin:", { error: error instanceof Error ? error.message : String(error) });
        return errorResponse("Error setting up super admin", 500);
    }
}
