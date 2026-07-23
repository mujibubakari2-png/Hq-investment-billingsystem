import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { hashPassword, errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";
import crypto from "crypto";

function generateTempPassword(length = 14): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    const max = 256 - (256 % chars.length);
    const result: string[] = [];
    while (result.length < length) {
        const buf = crypto.randomBytes(length * 2);
        for (let i = 0; i < buf.length && result.length < length; i++) {
            if (buf[i] < max) result.push(chars[buf[i] % chars.length]);
        }
    }
    return result.join("");
}

/**
 * PATCH /api/super-admin/admins/[id]  — update/disable/reset password
 * DELETE /api/super-admin/admins/[id] — remove platform admin (cannot remove self)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await params;
        const db = getTenantClient(null);
        const body = await req.json();
        const { action, fullName, email, phone, status } = body;

        // Verify target is a platform admin
        const target = await db.user.findUnique({
            where: { id },
            select: { id: true, email: true, username: true, tenantId: true, role: true },
        });
        if (!target) return errorResponse("Admin not found", 404);
        if (target.tenantId !== null) return errorResponse("Target is not a platform admin", 403);

        if (action === "reset_password") {
            const tempPassword = generateTempPassword();
            const hashed = await hashPassword(tempPassword);
            await db.user.update({ where: { id }, data: { password: hashed } });

            await writeAuditLog({
                tenantId: "platform", userId: guard.user.userId,
                action: "PLATFORM_RESET_ADMIN_PASSWORD", resource: "User", resourceId: id,
                details: { targetEmail: target.email }, ipAddress: getIpFromRequest(req),
            }).catch(() => {});

            return jsonResponse({ message: "Password reset. Share new credentials securely.", tempPassword });
        }

        if (action === "toggle_status") {
            if (id === guard.user.userId) return errorResponse("Cannot change your own status", 400);
            const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await db.user.update({ where: { id }, data: { status: newStatus } });

            await writeAuditLog({
                tenantId: "platform", userId: guard.user.userId,
                action: "PLATFORM_UPDATE_ADMIN_STATUS", resource: "User", resourceId: id,
                details: { status: newStatus }, ipAddress: getIpFromRequest(req),
            }).catch(() => {});

            return jsonResponse({ message: `Admin ${newStatus === "ACTIVE" ? "activated" : "deactivated"} successfully` });
        }

        // Update profile
        const updated = await db.user.update({
            where: { id },
            data: {
                ...(fullName && { fullName }),
                ...(email && { email }),
                ...(phone !== undefined && { phone }),
            },
            select: { id: true, username: true, email: true, fullName: true, status: true, updatedAt: true },
        });

        await writeAuditLog({
            tenantId: "platform", userId: guard.user.userId,
            action: "PLATFORM_UPDATE_ADMIN", resource: "User", resourceId: id,
            details: { fullName, email }, ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message: "Admin updated", admin: updated });
    } catch (e) {
        logger.error("Super Admin PATCH Admin Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const { id } = await params;
        if (id === guard.user.userId) return errorResponse("Cannot delete your own account", 400);

        const db = getTenantClient(null);
        const target = await db.user.findUnique({ where: { id }, select: { id: true, email: true, tenantId: true } });
        if (!target) return errorResponse("Admin not found", 404);
        if (target.tenantId !== null) return errorResponse("Target is not a platform admin", 403);

        await db.user.delete({ where: { id } });

        await writeAuditLog({
            tenantId: "platform", userId: guard.user.userId,
            action: "PLATFORM_DELETE_ADMIN", resource: "User", resourceId: id,
            details: { email: target.email }, ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message: "Platform admin deleted successfully" });
    } catch (e) {
        logger.error("Super Admin DELETE Admin Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
