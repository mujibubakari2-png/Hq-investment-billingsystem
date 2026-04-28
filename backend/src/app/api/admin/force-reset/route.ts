import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, hashPassword } from "@/lib/auth";


export async function GET(req: NextRequest) {
    try {
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

        const hashedPassword = await hashPassword(password);
        
        await prisma.user.upsert({
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
        
        return jsonResponse({
            message: `User ${email} is now SUPER_ADMIN`
        });
    } catch (error: any) {
        console.error("[FORCE RESET ERROR]:", error);
        return errorResponse("Error resetting user", 500);
    }
}
