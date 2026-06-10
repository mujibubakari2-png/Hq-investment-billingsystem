import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/hotspot-settings?routerId=...
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const routerId = searchParams.get("routerId");

        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const router = await prisma.router.findUnique({ where: { id: routerId } });
        if (!router) return errorResponse("Router not found", 404);
        
        if (userPayload.role !== "SUPER_ADMIN" && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to access this router's settings", 403);
        }

        let settings = await prisma.hotspotSettings.findUnique({
            where: { routerId },
        });

        // If no settings exist yet, create defaults
        if (!settings) {
            settings = await prisma.hotspotSettings.create({
                data: {
                    routerId,
                    tenantId: router.tenantId
                }
            });
        }

        return jsonResponse(settings);
    } catch (e: any) {
        console.error(e);
        return errorResponse(e?.message || "Internal server error", 500);
    }
}

// POST /api/hotspot-settings — save settings and auto-sync to MikroTik
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { routerId, ...data } = body;

        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        // Only SUPER_ADMIN can update hotspot settings
        if (userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const router = await prisma.router.findUnique({ where: { id: routerId } });
        if (!router) return errorResponse("Router not found", 404);
        
        if (router.tenantId && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Unauthorized to update this router's settings", 403);
        }

        const tenantId = router.tenantId;

        const settings = await prisma.hotspotSettings.upsert({
            where: { routerId },
            update: { ...data },
            create: {
                routerId,
                ...data,
                tenantId: tenantId || null,
            },
        });

        // ── Auto-sync to MikroTik ──────────────────────────────────────────────
        let synced = false;
        let syncError: string | null = null;

        try {
            // Check if tenant has hotspot auto-sync enabled
            const tenantSettings = tenantId
                ? await prisma.tenantSettings.findUnique({ where: { tenantId } })
                : null;

            const autoSyncEnabled = tenantSettings?.hotspotAutoSync !== false; // default true

            if (autoSyncEnabled && router.host) {
                const { getMikroTikService } = await import("@/lib/mikrotik");
                const mikrotik = await getMikroTikService(router.id, tenantId);

                // Push hotspot login page customization to MikroTik
                // The mikrotik service handles the actual file upload / variable injection
                const pushResult = await mikrotik.pushHotspotSettings({
                    primaryColor: settings.primaryColor,
                    accentColor: settings.accentColor,
                    companyName: settings.companyName || "",
                    customerCareNumber: settings.customerCareNumber || "",
                    selectedFont: settings.selectedFont,
                    layout: settings.layout,
                    adMessage: settings.adMessage || "",
                    enableAds: settings.enableAds,
                    enableAnnouncement: settings.enableAnnouncement,
                    enableRememberMe: settings.enableRememberMe,
                    backendUrl: settings.backendUrl || "",
                });

                if (pushResult && pushResult.success) {
                    synced = true;
                } else {
                    syncError = pushResult.message || "Failed to push settings to router";
                }
            } else if (!autoSyncEnabled) {
                syncError = "Auto-sync is disabled in tenant settings";
            } else {
                syncError = "Router host not configured";
            }
        } catch (syncErr: any) {
            syncError = syncErr?.message || "Failed to connect to MikroTik";
            console.error("[HOTSPOT-SYNC] Auto-sync error:", syncErr?.message);
        }

        return jsonResponse({
            settings,
            saved: true,
            synced,
            syncError,
            syncMessage: synced
                ? "✅ Settings saved and pushed to MikroTik successfully."
                : `⚠️ Settings saved locally. MikroTik sync failed: ${syncError}`,
        });
    } catch (e: any) {
        console.error(e);
        return errorResponse(e?.message || "Internal server error", 500);
    }
}
