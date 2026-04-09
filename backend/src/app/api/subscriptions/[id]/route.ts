import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { parseOptionalDate } from "@/lib/dateUtils";

// GET /api/subscriptions/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const sub = await prisma.subscription.findUnique({
            where: { id },
            include: { client: true, package: true, router: true },
        });
        if (!sub) return errorResponse("Subscription not found", 404);
        return jsonResponse(sub);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/subscriptions/[id] - edit plan / extend
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        const body = await req.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.packageId) data.packageId = body.packageId;
        if (body.routerId !== undefined) data.routerId = body.routerId || null;
        if (body.expiresAt !== undefined) { const pd = parseOptionalDate(body.expiresAt); if (pd) data.expiresAt = pd; }
        if (body.activatedAt !== undefined) { const pd = parseOptionalDate(body.activatedAt); if (pd) data.activatedAt = pd; }
        if (body.status) data.status = body.status;
        if (body.method) data.method = body.method;

        const sub = await prisma.subscription.update({
            where: { id },
            data,
            include: { client: true, package: true, router: true },
        });

        return jsonResponse(sub);
    } catch (e) {
        console.error("SUBSCRIPTION UPDATE ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/subscriptions/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        await prisma.subscription.delete({ where: { id } });
        return jsonResponse({ message: "Subscription deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
