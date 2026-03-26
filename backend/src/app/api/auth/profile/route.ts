import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, comparePassword, jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/auth/profile - Get own profile
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const user = await prisma.user.findUnique({
            where: { id: userPayload.userId },
            select: { id: true, username: true, email: true, role: true, phone: true, fullName: true },
        });

        if (!user) return errorResponse("User not found", 404);
        return jsonResponse(user);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/auth/profile - Update own profile
export async function PUT(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const body = await req.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.fullName) data.fullName = body.fullName;
        if (body.username) data.username = body.username;
        if (body.email) data.email = body.email;
        if (body.phone !== undefined) data.phone = body.phone;

        // Handle password change
        if (body.currentPassword && body.newPassword) {
            const user = await prisma.user.findUnique({ where: { id: userPayload.userId } });
            if (!user) return errorResponse("User not found", 404);

            const isValid = await comparePassword(body.currentPassword, user.password);
            if (!isValid) return errorResponse("Current password is incorrect", 400);

            data.password = await hashPassword(body.newPassword);
        }

        const updated = await prisma.user.update({
            where: { id: userPayload.userId },
            data,
            select: { id: true, username: true, email: true, role: true, phone: true, fullName: true },
        });

        return jsonResponse({ ...updated, message: "Profile updated successfully" });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
