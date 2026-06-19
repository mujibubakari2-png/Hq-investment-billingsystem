import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { canAccessTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { parseOptionalDate } from "@/lib/dateUtils";
import { SubscriptionUpdateSchema } from "@/lib/validators";

// GET /api/subscriptions/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "subscriptions:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const sub = await db.subscription.findUnique({
            where: { id },
            include: { client: true, package: true, router: true },
        });
        if (!sub) return errorResponse("Subscription not found", 404);
        if (!canAccessTenant(userPayload, sub.tenantId)) return errorResponse("Forbidden", 403);
        return jsonResponse(sub);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/subscriptions/[id] - edit plan / extend
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "subscriptions:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const parsed = SubscriptionUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const update = parsed.data;

        const existing = await db.subscription.findUnique({ where: { id } });
        if (!existing || !canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Subscription not found", 404);

        const data: any = {};
        if (update.packageId) data.packageId = update.packageId;
        if (update.routerId !== undefined) data.routerId = update.routerId || null;
        if (update.expiresAt !== undefined) { const pd = parseOptionalDate(update.expiresAt as any); if (pd) data.expiresAt = pd; }
        if (update.activatedAt !== undefined) { const pd = parseOptionalDate(update.activatedAt as any); if (pd) data.activatedAt = pd; }
        if (update.status) data.status = update.status;
        if (update.method) data.method = update.method;

        const sub = await db.subscription.update({ where: { id }, data, include: { client: true, package: true, router: true } });

        return jsonResponse(sub);
    } catch (e) {
        console.error("SUBSCRIPTION UPDATE ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/subscriptions/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "subscriptions:delete");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const existing = await db.subscription.findUnique({ where: { id } });
        if (!existing) return errorResponse("Subscription not found", 404);

        if (userPayload.role === "VIEWER") return errorResponse("Forbidden", 403);
        if (!canAccessTenant(userPayload, existing.tenantId)) return errorResponse("Forbidden", 403);

        await db.subscription.delete({ where: { id } });
        return jsonResponse({ message: "Subscription deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
