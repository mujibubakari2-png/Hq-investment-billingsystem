import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { env } from "@/lib/env";

/**
 * GET /api/hotspot/portal-config?routerId=...
 *
 * E19 FIX: Public (no-auth) endpoint that returns the HotspotSettings for a given router,
 * including the backendUrl field. The MikroTik captive portal HTML page calls this on load
 * to obtain:
 *   - backendUrl: the primary URL for all subsequent API calls (purchase, status, check-mac)
 *   - Branding: colors, font, company name, layout for UI rendering
 *
 * The portal JS should cache backendUrl and prefix all API calls with it instead of
 * using a hardcoded URL embedded in the portal template.
 *
 * This endpoint intentionally does NOT require authentication — it is called by
 * unauthenticated browsers on the captive portal page before login.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const routerId = searchParams.get("routerId");

    if (!routerId) {
      return errorResponse("routerId is required", 400);
    }

    // Verify the router exists (no tenantId leak — only expose safe fields)
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      select: { id: true, name: true, status: true, tenantId: true },
    });

    if (!router) {
      return errorResponse("Router not found", 404);
    }

    const db = getTenantClient(router.tenantId);
    const settings = await db.hotspotSettings.findUnique({
      where: { routerId },
      select: {
        primaryColor: true,
        accentColor: true,
        selectedFont: true,
        layout: true,
        enableAds: true,
        enableAnnouncement: true,
        enableRememberMe: true,
        companyName: true,
        customerCareNumber: true,
        adMessage: true,
        // E19: The primary field — portal JS uses this as the base URL for all API calls
        backendUrl: true,
      },
    });

    // E19: Resolve the effective backend URL for this router.
    // Priority: HotspotSettings.backendUrl > APP_URL env var > null (portal uses relative URLs)
    const effectiveBackendUrl =
      settings?.backendUrl ||
      env.APP_URL ||
      null;

    return jsonResponse({
      routerId: router.id,
      routerName: router.name,
      // E19: Portal JS MUST use this URL as the base for /api/hotspot/purchase, /api/hotspot/status, etc.
      backendUrl: effectiveBackendUrl,
      settings: settings ?? {},
    });
  } catch (e) {
    console.error("[HOTSPOT PORTAL CONFIG] Error:", e);
    return errorResponse("Internal server error", 500);
  }
}
