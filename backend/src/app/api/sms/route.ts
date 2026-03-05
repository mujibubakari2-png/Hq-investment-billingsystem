import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/sms
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const type = searchParams.get("type") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        if (status) where.status = status;
        if (type) where.type = type;

        const [messages, total] = await Promise.all([
            prisma.smsMessage.findMany({
                where,
                include: { client: { select: { username: true, fullName: true } } },
                orderBy: { sentAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.smsMessage.count({ where }),
        ]);

        return jsonResponse({ data: messages, total, page, limit });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/sms - send individual SMS
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const sms = await prisma.smsMessage.create({
            data: {
                clientId: body.clientId,
                recipient: body.recipient,
                message: body.message,
                type: body.type === "Broadcast" ? "BROADCAST" : "INDIVIDUAL",
                status: "SENT", // In real app this would be PENDING until SMS gateway confirms
            },
        });

        return jsonResponse(sms, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
