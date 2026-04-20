import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";

// GET /api/radius/users – list RADIUS users (tenant-isolated)
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { filter } = getTenantFilter(userPayload);

        const users = await prisma.radiusUser.findMany({
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const body = await req.json();
        const { username, password, fullName, authType, groupName, speed, dataLimit, sessionTimeout, simultaneousUse, framedIpAddress } = body;

        if (!username || !password) {
            return errorResponse("Username and password are required", 400);
        }

        const tenantId = getAssignTenantId(userPayload, body.tenantId);

        // Check for duplicate username within the same tenant
        const existing = await prisma.radiusUser.findFirst({ 
            where: { username, tenantId } 
        });
        if (existing) return errorResponse("RADIUS username already exists for this tenant", 409);

        const user = await prisma.radiusUser.create({
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
