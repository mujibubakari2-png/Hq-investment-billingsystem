import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { comparePassword, signToken, jsonResponse, errorResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return errorResponse("Username and password are required");
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return errorResponse("Invalid credentials", 401);
        }

        if (user.status !== "ACTIVE") {
            return errorResponse("Account is disabled", 403);
        }

        const valid = await comparePassword(password, user.password);
        if (!valid) {
            return errorResponse("Invalid credentials", 401);
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        const token = signToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
        });

        return jsonResponse({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                phone: user.phone,
                tenantId: user.tenantId,
            },
        });
    } catch (e) {
        console.error("LOGIN ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
