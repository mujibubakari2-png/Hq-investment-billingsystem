import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/users - list system users (Admin only)
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden: Admin access required", 403);
        }

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const users = await prisma.user.findMany({
            where: { ...tenantFilter },
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
            orderBy: { createdAt: "desc" },
        });

        const mapped = users.map((u) => ({
            id: u.id,
            username: u.username,
            fullName: u.fullName,
            email: u.email,
            role: u.role === "SUPER_ADMIN" ? "Super Admin" : u.role.charAt(0) + u.role.slice(1).toLowerCase(),
            status: u.status === "ACTIVE" ? "Active" : "Inactive",
            phone: u.phone,
            lastLogin: u.lastLogin,
            createdAt: u.createdAt,
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/users - create system user (Admin only)
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden: Admin access required", 403);
        }

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };
        
        const body = await req.json();

        if (!body.username || !body.email || !body.password) {
            return errorResponse("Username, email, and password are required");
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [{ username: body.username }, { email: body.email }] },
        });
        
        if (existing) return errorResponse("Username or email already exists globally");

        const roleMap: Record<string, "SUPER_ADMIN" | "ADMIN" | "AGENT" | "VIEWER"> = {
            "Super Admin": "SUPER_ADMIN",
            "Admin": "ADMIN",
            "Agent": "AGENT",
            "Viewer": "VIEWER",
        };

        const assignedRole = roleMap[body.role] || "AGENT";
        
        // Prevent tenant admins from escalating users to Super Admin
        if (!isSuperAdmin && assignedRole === "SUPER_ADMIN") {
            return errorResponse("Forbidden: Cannot bestow Super Admin status.", 403);
        }

        const tenantIdValue = isSuperAdmin ? (body.tenantId || null) : userPayload.tenantId;

        const user = await prisma.user.create({
            data: {
                username: body.username,
                fullName: body.fullName,
                email: body.email,
                password: await hashPassword(body.password),
                phone: body.phone,
                role: assignedRole,
                tenantId: tenantIdValue
            },
            select: { id: true, username: true, email: true, role: true, status: true },
        });

        return jsonResponse(user, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
