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
 * GET  /api/super-admin/admins  — list all platform admins (tenantId IS NULL)
 * POST /api/super-admin/admins  — create a new platform admin
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const admins = await db.user.findMany({
            where: { tenantId: null },
            select: {
                id: true,
                username: true,
                email: true,
                fullName: true,
                phone: true,
                role: true,
                status: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return jsonResponse({ data: admins, total: admins.length });
    } catch (e) {
        logger.error("Super Admin GET Admins Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        const { username, email, fullName, phone } = body;

        if (!email || !username) {
            return errorResponse("email and username are required", 400);
        }

        // Check uniqueness
        const existing = await db.user.findFirst({
            where: { OR: [{ email }, { username }], tenantId: null },
        });
        if (existing) {
            return errorResponse("An admin with this email or username already exists", 409);
        }

        const tempPassword = generateTempPassword();
        const hashed = await hashPassword(tempPassword);

        const admin = await db.user.create({
            data: {
                username,
                email,
                fullName: fullName || username,
                phone: phone || null,
                password: hashed,
                role: "SUPER_ADMIN",
                status: "ACTIVE",
                tenantId: null, // Platform admin — NO tenant
            },
            select: { id: true, username: true, email: true, fullName: true, role: true, status: true, createdAt: true },
        });

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_CREATE_ADMIN",
            resource: "User",
            resourceId: admin.id,
            details: { email, username },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({
            message: "Platform admin created successfully",
            admin,
            credentials: {
                email,
                tempPassword,
                note: "Share this password securely. The admin should change it on first login.",
            },
        }, 201);
    } catch (e) {
        logger.error("Super Admin POST Admin Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
