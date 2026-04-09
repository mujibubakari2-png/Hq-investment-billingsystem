import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

// ── DEVELOPMENT/DEBUG ONLY — secured with SUPER_ADMIN auth ───────────────────
// Backdates a specific tenant's license so you can test the suspension flow.
// Usage: GET /api/test-suspend?tenantId=<id>   (defaults to first tenant)

export async function GET(req: NextRequest) {
    const user = getUserFromRequest(req);
    if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");

    const tenant = tenantId
        ? await prisma.tenant.findUnique({ where: { id: tenantId } })
        : await prisma.tenant.findFirst();

    if (!tenant) return NextResponse.json({ error: "No tenant found" }, { status: 404 });

    await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
            licenseExpiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            status: "ACTIVE"   // backend license check will auto-suspend on next GET /api/license
        }
    });

    return NextResponse.json({
        message: `Tenant "${tenant.name}" license backdated 5 days. Next /api/license call will auto-suspend.`,
        tenantId: tenant.id
    });
}
