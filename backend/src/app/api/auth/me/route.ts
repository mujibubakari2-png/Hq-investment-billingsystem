import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest, jsonResponse, errorResponse } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const payload = getUserFromRequest(req);
        if (!payload) {
            return errorResponse("Unauthorized", 401);
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                phone: true,
                status: true,
                lastLogin: true,
                tenantId: true,
            },
        });

        if (!user) {
            return errorResponse("User not found", 404);
        }

        return jsonResponse({
            ...user,
            tenant_id: user.tenantId, // Alias for tests
        });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
