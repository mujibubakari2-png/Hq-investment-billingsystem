import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getRouterAdapter } from "@/lib/routerAdapters";
import logger from "@/lib/logger";
import { errorResponse } from "@/lib/auth";

/**
 * GET /api/routers/[id]/capabilities
 * 
 * Returns the discovered capabilities and metadata for a router.
 * Useful for frontend to gate UI based on router vendor/version.
 * 
 * Response: { vendor, firmwareVersion, architecture, apiType, supportedFeatures, capabilities, lastDiscovery }
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = requirePermission(req, "view:routers");
    if (guard.error) return guard.error;

    const { tenantId } = guard.user || {};
    const routerId = params.id;

    const db = getTenantClient(null);
    const router = await db.router.findUnique({ where: { id: routerId } });

    if (!router) {
      return errorResponse("Router not found", 404);
    }

    // Verify tenant access
    if (tenantId && router.tenantId !== tenantId) {
      return errorResponse("Unauthorized", 403);
    }

    // Return capabilities from DB (persisted by discovery job or live)
    let capabilities = router.capabilities || null;
    if (typeof capabilities === 'string') {
        try { capabilities = JSON.parse(capabilities); } catch (e) { capabilities = {}; }
    }

    return NextResponse.json({
      vendor: router.vendor || "mikrotik",
      firmwareVersion: router.firmwareVersion || null,
      architecture: router.architecture || null,
      apiType: router.apiType || "UNKNOWN",
      supportedFeatures: router.supportedFeatures || [],
      capabilities: capabilities || {},
      lastDiscovery: router.lastDiscovery,
      healthStatus: router.healthStatus,
      provisioningStatus: router.provisioningStatus,
    });
  } catch (error: any) {
    logger.error("[Capabilities] Error retrieving capabilities", {
      error: error?.message,
    });
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/routers/[id]/capabilities/refresh
 * 
 * Trigger a live capability discovery on the router (expensive operation).
 * Stores the result in the database for future use.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const guard = requirePermission(req, "manage:routers");
    if (guard.error) return guard.error;

    const { tenantId } = guard.user || {};
    const routerId = params.id;

    const db = getTenantClient(null);
    const router = await db.router.findUnique({ where: { id: routerId } });

    if (!router) {
      return errorResponse("Router not found", 404);
    }

    // Verify tenant access
    if (tenantId && router.tenantId !== tenantId) {
      return errorResponse("Unauthorized", 403);
    }

    // Discover live
    const adapter = await getRouterAdapter(routerId, tenantId ?? null);
    const capabilities = await adapter.discoverCapabilities();

    logger.info("[Capabilities] Refreshed capabilities for router", {
      routerId,
      vendor: capabilities.vendor,
      firmwareVersion: capabilities.firmwareVersion,
    });

    return NextResponse.json({
      success: true,
      capabilities: {
        vendor: capabilities.vendor,
        firmwareVersion: capabilities.firmwareVersion,
        architecture: capabilities.architecture,
        apiType: capabilities.apiType,
        supportedFeatures: capabilities.supportedFeatures,
        capabilities: capabilities.capabilities,
      },
    });
  } catch (error: any) {
    logger.error("[Capabilities] Error refreshing capabilities", {
      error: error?.message,
    });
    return errorResponse(`Failed to discover capabilities: ${error?.message}`, 500);
  }
}
