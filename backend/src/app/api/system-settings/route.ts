import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/settings — all roles can read (branding, company name, etc.)
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };
        
        let settings = await db.systemSetting.findMany({ where: tenantFilter });
        
        // Fallback to global settings if tenant settings are totally empty
        if (settings.length === 0 && !isSuperAdmin) {
            settings = await db.systemSetting.findMany({ where: { tenantId: null } });
        }

        const mapped: Record<string, string> = {};
        settings.forEach((s) => {
            mapped[s.key] = s.value;
        });
        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/settings — SUPER_ADMIN only: update tenant system settings
export async function PUT(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        // RBAC-001: Only Super Admin can change system settings.
        // Admins, Agents, and Viewers inherit settings from the tenant owner.
        if (userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Only the tenant Super Admin can update system settings", 403);
        }

        const tenantIdValue = userPayload.tenantId;
        const body = await req.json();

        for (const [key, value] of Object.entries(body)) {
            const existing = await db.systemSetting.findFirst({
                where: { key, tenantId: tenantIdValue }
            });
            
            if (existing) {
                await db.systemSetting.update({
                    where: { id: existing.id },
                    data: { value: String(value) },
                });
            } else {
                await db.systemSetting.create({
                    data: { key, value: String(value), tenantId: tenantIdValue }
                });
            }
        }

        const allSettings = await db.systemSetting.findMany({ where: { tenantId: tenantIdValue } });
        const mapped: Record<string, string> = {};
        allSettings.forEach((s) => {
            mapped[s.key] = s.value;
        });

        return jsonResponse({ message: "Settings updated", settings: mapped });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
