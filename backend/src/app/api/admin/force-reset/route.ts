import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";


export async function GET(req: NextRequest) {
    try {
        const rateLimitResponse = await checkRateLimit(req);
        if (rateLimitResponse) return rateLimitResponse;

        if (process.env.NODE_ENV === "production") {
            return errorResponse("Not found", 404);
        }
        const setupEnabled = process.env.ENABLE_SUPER_ADMIN_SETUP === "true";
        const setupKey = process.env.SUPER_ADMIN_SETUP_KEY;
        const providedKey = req.headers.get("x-setup-key");
        if (!setupEnabled || !setupKey || providedKey !== setupKey) {
            return errorResponse("Not found", 404);
        }

        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        if (!email || !password) {
            return errorResponse("Server setup is incomplete", 500);
        }

        const db = getTenantClient(null);
        const hashedPassword = await hashPassword(password);

        const result = await db.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: "SUPER_ADMIN",
                status: "ACTIVE",
                tenantId: null
            },
            create: {
                email,
                username: "superadmin",
                password: hashedPassword,
                role: "SUPER_ADMIN",
                status: "ACTIVE",
                fullName: "Platform Super Admin"
            }
        });

        return jsonResponse({ message: `User ${result.email} is now SUPER_ADMIN` });
    } catch (error: any) {
        console.error("[FORCE RESET ERROR]:", error);
        return errorResponse("Error resetting user", 500);
    }
}
