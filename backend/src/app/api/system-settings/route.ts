import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
// GET /api/settings — all roles can read (branding, company name, etc.)
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "system-settings:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
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
        const guard = requirePermission(req, "system-settings:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

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
