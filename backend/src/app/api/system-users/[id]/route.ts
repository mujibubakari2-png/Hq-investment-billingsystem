import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { hashPassword, jsonResponse, errorResponse } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";

/**
 * ── SECURITY FIX ──────────────────────────────────────────────────────────────
 * All handlers now:
 *  1. Block access to platform admins (tenantId IS NULL) — those are managed
 *     exclusively via /api/super-admin/admins
 *  2. Include audit logging for all state-changing operations
 * ─────────────────────────────────────────────────────────────────────────────
 */

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

        // ── SECURITY: Block access to platform admins ─────────────────────────
        if (user.tenantId === null) {
            return errorResponse("Access denied. Platform admins are managed via the Super Admin portal.", 403);
        }

        if (!canAccessTenant(userPayload, user.tenantId)) return errorResponse("Forbidden", 403);
        return jsonResponse(user);
    } catch (e) {
        logger.error("[system-users/id] GET failed", { error: e instanceof Error ? e.message : String(e) });
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
            select: { id: true, role: true, tenantId: true, email: true },
        });
        if (!existing) return errorResponse("User not found", 404);

        // ── SECURITY: Block modification of platform admins ───────────────────
        if (existing.tenantId === null) {
            return errorResponse("Access denied.", 403);
        }

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
                Admin: "ADMIN",
                Agent: "AGENT",
                Viewer: "VIEWER",
            };
            const mappedRole = roleMap[body.role] || body.role;
            // ── SECURITY: Block role escalation to SUPER_ADMIN ────────────────
            if (mappedRole === "SUPER_ADMIN") {
                return errorResponse("Cannot promote to SUPER_ADMIN via this endpoint.", 403);
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

        await writeAuditLog({
            tenantId: existing.tenantId,
            userId: userPayload.userId,
            action: "UPDATE_USER",
            resource: "User",
            resourceId: id,
            details: { updatedFields: Object.keys(data), targetEmail: existing.email },
            ipAddress: getIpFromRequest(req),
        }).catch(() => { });

        return jsonResponse(user);
    } catch (e) {
        logger.error("[system-users/id] PUT failed", { error: e instanceof Error ? e.message : String(e) });
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
            select: { id: true, role: true, tenantId: true, email: true },
        });
        if (!existing) return errorResponse("User not found", 404);

        // ── SECURITY: Block deletion of platform admins ───────────────────────
        if (existing.tenantId === null) {
            return errorResponse("Access denied. Platform admins are managed via the Super Admin portal.", 403);
        }

        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);
        if (existing.role === "SUPER_ADMIN") {
            return errorResponse("Cannot delete the tenant owner", 403);
        }

        await db.user.delete({ where: { id } });

        await writeAuditLog({
            tenantId: existing.tenantId,
            userId: userPayload.userId,
            action: "DELETE_USER",
            resource: "User",
            resourceId: id,
            details: { targetEmail: existing.email },
            ipAddress: getIpFromRequest(req),
        }).catch(() => { });

        return jsonResponse({ message: "User deleted successfully" });
    } catch (e) {
        logger.error("[system-users/id] DELETE failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
