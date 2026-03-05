import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/users - list system users
export async function GET() {
    try {
        const users = await prisma.user.findMany({
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
            orderBy: { createdAt: "desc" },
        });

        const mapped = users.map((u: {
            id: string;
            username: string;
            email: string;
            role: string;
            status: string;
            phone: string | null;
            lastLogin: Date | null;
        }) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role === "SUPER_ADMIN" ? "Super Admin" : u.role.charAt(0) + u.role.slice(1).toLowerCase(),
            status: u.status === "ACTIVE" ? "Active" : "Inactive",
            phone: u.phone,
            lastLogin: u.lastLogin?.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) || "Never",
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/users - create system user
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.username || !body.email || !body.password) {
            return errorResponse("Username, email, and password are required");
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [{ username: body.username }, { email: body.email }] },
        });
        if (existing) return errorResponse("Username or email already exists");

        const roleMap: Record<string, string> = {
            "Super Admin": "SUPER_ADMIN",
            Admin: "ADMIN",
            Agent: "AGENT",
            Viewer: "VIEWER",
        };

        const user = await prisma.user.create({
            data: {
                username: body.username,
                email: body.email,
                password: await hashPassword(body.password),
                phone: body.phone,
                role: (roleMap[body.role] || "AGENT") as "SUPER_ADMIN" | "ADMIN" | "AGENT" | "VIEWER",
            },
            select: { id: true, username: true, email: true, role: true, status: true },
        });

        return jsonResponse(user, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
