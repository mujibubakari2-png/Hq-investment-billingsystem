import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, hashPassword } from "@/lib/auth";


export async function GET(req: NextRequest) {
    try {
        const email = "superadmin@hqinvestment.co.tz";
        const password = "hq-admin-2026";
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
            message: `User ${email} is now SUPER_ADMIN with password ${password}`
        });
    } catch (error: any) {
        return errorResponse(error.message || "Error resetting user", 500);
    }
}
