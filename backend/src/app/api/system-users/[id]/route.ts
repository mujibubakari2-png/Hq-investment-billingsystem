import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
                phone: true,
                lastLogin: true,
                createdAt: true,
            },
        });
        if (!user) return errorResponse("User not found", 404);
        return jsonResponse(user);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;
        const body = await req.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.username) data.username = body.username;
        if (body.fullName !== undefined) data.fullName = body.fullName;
        if (body.email) data.email = body.email;
        if (body.phone !== undefined) data.phone = body.phone;
        if (body.role) {
            const roleMap: Record<string, string> = {
                "Super Admin": "SUPER_ADMIN",
                Admin: "ADMIN",
                Agent: "AGENT",
                Viewer: "VIEWER",
            };
            const mappedRole = roleMap[body.role] || body.role;
            // Only SUPER_ADMIN can assign SUPER_ADMIN role
            if (mappedRole === "SUPER_ADMIN" && userPayload.role !== "SUPER_ADMIN") {
                return errorResponse("Forbidden: Only Super Admin can assign Super Admin role", 403);
            }
            data.role = mappedRole;
        }
        if (body.status) {
            const statusMap: Record<string, string> = {
                Active: "ACTIVE",
                Inactive: "INACTIVE",
                Banned: "BANNED",
                Pending: "PENDING",
            };
            data.status = statusMap[body.status] || body.status;
        }
        if (body.password) {
            data.password = await hashPassword(body.password);
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, username: true, fullName: true, email: true, role: true, status: true, phone: true },
        });

        return jsonResponse(user);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden", 403);
        }

        const { id } = await params;

        // Prevent self-deletion
        if (userPayload.userId === id) {
            return errorResponse("Cannot delete your own account", 400);
        }

        await prisma.user.delete({ where: { id } });
        return jsonResponse({ message: "User deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
