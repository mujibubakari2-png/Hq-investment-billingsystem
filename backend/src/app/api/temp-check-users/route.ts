import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const users = await prisma.user.findMany({
            select: {
                email: true,
                role: true,
                tenantId: true
            }
        });
        
        return jsonResponse(users);
    } catch (error: any) {
        console.error("Error fetching users:", error);
        return errorResponse(error.message || "Error fetching users", 500);
    }
}
