import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/subscriptions/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
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
        const { id } = await params;
        const body = await req.json();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {};
        if (body.packageId) data.packageId = body.packageId;
        if (body.expiresAt) data.expiresAt = new Date(body.expiresAt);
        if (body.status) data.status = body.status;
        if (body.method) data.method = body.method;

        const sub = await prisma.subscription.update({
            where: { id },
            data,
            include: { client: true, package: true, router: true },
        });

        return jsonResponse(sub);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

// DELETE /api/subscriptions/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.subscription.delete({ where: { id } });
        return jsonResponse({ message: "Subscription deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
