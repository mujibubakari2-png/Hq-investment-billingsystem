import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/payment-channels
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

        const channels = await prisma.paymentChannel.findMany({
            where: { ...tenantFilter },
            orderBy: { createdAt: "desc" },
        });

        const mapped = channels.map((ch: {
            id: string;
            name: string;
            provider: string;
            accountNumber: string | null;
            status: string;
            createdAt: Date;
            config: unknown;
        }) => ({
            id: ch.id,
            name: ch.name,
            provider: ch.provider,
            accountNumber: ch.accountNumber,
            status: ch.status === "ACTIVE" ? "Active" : "Inactive",
            createdAt: ch.createdAt.toLocaleDateString("en-US", { timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric" }),
            config: ch.config,
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/payment-channels
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const body = await req.json();

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantIdValue = userPayload.tenantId;

        const channel = await prisma.paymentChannel.create({
            data: {
                name: body.name,
                provider: body.provider,
                accountNumber: body.accountNumber,
                apiKey: body.apiKey,
                apiSecret: body.apiSecret,
                config: body.config,
                tenantId: tenantIdValue
            },
        });

        return jsonResponse(channel, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
