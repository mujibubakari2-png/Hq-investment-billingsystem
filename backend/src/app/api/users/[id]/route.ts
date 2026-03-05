import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, jsonResponse, errorResponse } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
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
        const { id } = await params;
        const body = await req.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.username) data.username = body.username;
        if (body.email) data.email = body.email;
        if (body.phone !== undefined) data.phone = body.phone;
        if (body.role) {
            const roleMap: Record<string, string> = {
                "Super Admin": "SUPER_ADMIN",
                Admin: "ADMIN",
                Agent: "AGENT",
                Viewer: "VIEWER",
            };
            data.role = roleMap[body.role] || body.role;
        }
        if (body.status) {
            data.status = body.status === "Active" ? "ACTIVE" : "INACTIVE";
        }
        if (body.password) {
            data.password = await hashPassword(body.password);
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, username: true, email: true, role: true, status: true, phone: true },
        });

        return jsonResponse(user);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.user.delete({ where: { id } });
        return jsonResponse({ message: "User deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
