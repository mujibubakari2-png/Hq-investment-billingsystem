import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const superAdminEmail = "superadmin@hqinvestment.co.tz";
        const superAdminPassword = "hq-admin-2026";
        const hashedPassword = await hashPassword(superAdminPassword);

        console.log("Setting up unique Super Admin account...");

        // 1. Check if the account already exists
        const existing = await prisma.user.findUnique({
            where: { email: superAdminEmail }
        });

        if (existing) {
            // Update to Super Admin role
            await prisma.user.update({
                where: { id: existing.id },
                data: {
                    role: "SUPER_ADMIN",
                    password: hashedPassword,
                    tenantId: null // Ensure global access
                }
            });
            console.log(`Updated existing account: ${superAdminEmail}`);
        } else {
            // Create new Super Admin account
            await prisma.user.create({
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
            console.log(`Created new Super Admin account: ${superAdminEmail}`);
        }

        // 2. Demote all other users with SUPER_ADMIN to ADMIN
        const others = await prisma.user.updateMany({
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
            password: superAdminPassword,
            demotedCount: others.count
        });
        
    } catch (error: any) {
        console.error("Error setting up super admin:", error);
        return errorResponse(error.message || "Error setting up super admin", 500);
    }
}
