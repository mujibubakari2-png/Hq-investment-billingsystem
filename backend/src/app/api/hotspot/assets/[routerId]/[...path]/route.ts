import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { verifyHotspotAssetToken, renderHotspotFile, contentTypeForAsset } from "@/lib/hotspotAssets";
import logger from "@/lib/logger";

/**
 * GET /api/hotspot/assets/[routerId]/[...path]?token=...
 *
 * PUBLIC endpoint — this is called by the MikroTik router itself via
 * `/tool fetch`, which cannot present a JWT/session like a normal API
 * client. Access is instead gated entirely by a short-lived HMAC token,
 * scoped to this exact routerId + file path, minted server-side only when
 * an authenticated admin triggers a hotspot-settings push
 * (see mikrotik.ts pushHotspotSettings() / lib/hotspotAssets.ts).
 *
 * Do NOT add any other authentication bypass here. Do NOT widen the token
 * scope to "any file for this router" without also widening what it can
 * read — renderHotspotFile() already blocks path traversal, but the token
 * is deliberately bound to one relPath at a time to keep the blast radius
 * of a leaked/expired-but-replayed token minimal.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ routerId: string; path: string[] }> }
) {
    try {
        const { routerId, path } = await params;
        const relPath = (path || []).join("/");
        const token = req.nextUrl.searchParams.get("token") || "";

        if (!routerId || !relPath) {
            return new Response("Not found", { status: 404 });
        }

        if (!verifyHotspotAssetToken(routerId, relPath, token)) {
            return new Response("Forbidden", { status: 403 });
        }

        // Unscoped lookup is intentional and safe: the caller already proved
        // authorization for this exact router+file via the signed token above,
        // which only an authenticated admin action could have minted.
        const db = getTenantClient(null);
        const router = await db.router.findUnique({
            where: { id: routerId },
            select: { id: true, hotspotSettings: true },
        });
        if (!router) return new Response("Not found", { status: 404 });

        const settings: any = router.hotspotSettings;
        const apiUrl = (
            settings?.backendUrl ||
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.APP_URL ||
            ""
        ).replace(/\/$/, "");

        const buffer = renderHotspotFile(relPath, {
            apiUrl,
            routerId,
            companyName: settings?.companyName,
            customerCareNumber: settings?.customerCareNumber,
            primaryColor: settings?.primaryColor,
            accentColor: settings?.accentColor,
        });
        const body = Buffer.from(buffer);

        return new Response(
            body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
            {
                status: 200,
                headers: {
                    "Content-Type": contentTypeForAsset(relPath),
                    // Tokens are single-purpose and short-lived; never let an
                    // intermediary cache (or re-serve) a rendered asset.
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (e: any) {
        logger.error("[Hotspot Assets] Failed to serve asset", {
            error: e instanceof Error ? e.message : String(e),
        });
        return new Response("Internal error", { status: 500 });
    }
}
