import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";

import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";
import { RadiusUserCreateSchema } from '@/lib/validators';

// GET /api/radius/users – list RADIUS users (tenant-isolated)
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter } = getTenantFilter(userPayload);

        const users = await db.radiusUser.findMany({
            where: { ...filter },
            orderBy: { createdAt: "desc" },
        });

        const result = users.map(u => ({
            id: u.id,
            username: u.username,
            fullName: u.fullName || "",
            authType: u.authType,
            groupName: u.groupName,
            status: u.status,
            speed: u.speed || "",
            dataLimit: u.dataLimit || "",
            sessionTimeout: u.sessionTimeout || "",
            simultaneousUse: u.simultaneousUse,
            nasIpAddress: u.nasIpAddress || "",
            framedIpAddress: u.framedIpAddress || "",
            lastSeen: u.lastSeen ? new Date(u.lastSeen).toLocaleString() : "",
            createdAt: new Date(u.createdAt).toLocaleDateString(),
        }));

        return jsonResponse(result);
    } catch (e) {
        console.error("RADIUS users list error:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/radius/users – create RADIUS user (tenant-isolated)
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const body = await req.json();
        const parsed = RadiusUserCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { username, password, fullName, authType, groupName, speed, dataLimit, sessionTimeout, simultaneousUse, framedIpAddress, tenantId: bodyTenantId } = parsed.data;

        if (!username || !password) {
            return errorResponse("Username and password are required", 400);
        }

        const tenantId = getAssignTenantId(userPayload, bodyTenantId);

        // Check for duplicate username within the same tenant
        const existing = await db.radiusUser.findFirst({
            where: { username, tenantId }
        });
        if (existing) return errorResponse("RADIUS username already exists for this tenant", 409);

        const user = await db.radiusUser.create({
            data: {
                username,
                password,
                fullName: fullName || null,
                authType: authType || "PAP",
                groupName: groupName || "default",
                speed: speed || null,
                dataLimit: dataLimit || null,
                sessionTimeout: sessionTimeout || null,
                simultaneousUse: simultaneousUse || 1,
                framedIpAddress: framedIpAddress || null,
                status: "Active",
                tenantId,
            },
        });

        return jsonResponse(user, 201);
    } catch (e) {
        console.error("RADIUS user create error:", e);
        return errorResponse("Internal server error", 500);
    }
}

