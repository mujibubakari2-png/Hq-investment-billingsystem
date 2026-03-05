import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/payment-channels
export async function GET() {
    try {
        const channels = await prisma.paymentChannel.findMany({
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
            createdAt: ch.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
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
        const body = await req.json();

        const channel = await prisma.paymentChannel.create({
            data: {
                name: body.name,
                provider: body.provider,
                accountNumber: body.accountNumber,
                apiKey: body.apiKey,
                apiSecret: body.apiSecret,
                config: body.config,
            },
        });

        return jsonResponse(channel, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
