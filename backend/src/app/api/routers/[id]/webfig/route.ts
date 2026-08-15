import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { canAccessTenant } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;

        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { id } = await params;

        const router = await db.router.findUnique({ where: { id } });
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Open WebFig</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
      .card { max-width: 640px; margin: 48px auto; padding: 24px; border-radius: 12px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
      a { color: #0f766e; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Open WebFig</h2>
      <p>The router management UI is available through the router's own WebFig endpoint.</p>
      <p><strong>Router:</strong> ${router.name || router.host}</p>
      <p><strong>Address:</strong> <code>${router.host}</code></p>
      <p>Open the router's WebFig page directly in a new browser tab using the router's IP or DNS name, then sign in with the router admin credentials.</p>
      <p><a href="http://${router.host}" target="_blank" rel="noreferrer">Open router WebFig</a></p>
    </div>
  </body>
</html>`;

        return new Response(html, {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return errorResponse("Failed to open WebFig", 500);
    }
}
