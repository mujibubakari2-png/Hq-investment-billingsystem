import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { hashPassword, jsonResponse, errorResponse } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { requireRole } from "@/lib/rbac";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const user = await db.user.findUnique({
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
                tenantId: true,
                createdById: true,
            },
        });
        if (!user) return errorResponse("User not found", 404);
        if (!canAccessTenant(userPayload, user.tenantId)) return errorResponse("Forbidden", 403);
        return jsonResponse(user);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();
        const existing = await db.user.findUnique({
            where: { id },
            select: { id: true, role: true, tenantId: true },
        });
        if (!existing) return errorResponse("User not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);
        if (existing.role === "SUPER_ADMIN" && existing.id !== userPayload.userId) {
            return errorResponse("Cannot edit another tenant owner", 403);
        }

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
            if (mappedRole === "SUPER_ADMIN") {
                return errorResponse("Each tenant has exactly one Super Admin owner.", 403);
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

        const user = await db.user.update({
            where: { id },
            data,
            select: { id: true, username: true, fullName: true, email: true, role: true, status: true, phone: true, tenantId: true },
        });

        return jsonResponse(user);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;

        // Prevent self-deletion
        if (userPayload.userId === id) {
            return errorResponse("Cannot delete your own account", 400);
        }

        const existing = await db.user.findUnique({
            where: { id },
            select: { id: true, role: true, tenantId: true },
        });
        if (!existing) return errorResponse("User not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);
        if (existing.role === "SUPER_ADMIN") {
            return errorResponse("Cannot delete the tenant owner", 403);
        }

        await db.user.delete({ where: { id } });
        return jsonResponse({ message: "User deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
