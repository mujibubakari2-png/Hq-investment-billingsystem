import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const usersToUpdate = ["hqbakari@gmail.com", "keemuu414@gmail.com", "mujibu@company.com"];
        
        console.log(`Updating roles for: ${usersToUpdate.join(", ")}`);
        
        const result = await prisma.user.updateMany({
            where: {
                email: { in: usersToUpdate, mode: 'insensitive' as any },
                role: "SUPER_ADMIN"
            },
            data: {
                role: "ADMIN"
            }
        });
        
        return jsonResponse({
            message: `Updated ${result.count} users to ADMIN role.`,
            updatedCount: result.count
        });
        
    } catch (error: any) {
        console.error("Error updating users:", error);
        return errorResponse(error.message || "Error updating users", 500);
    }
}
