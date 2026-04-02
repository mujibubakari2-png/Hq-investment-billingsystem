import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";

// GET /api/sms
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { filter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const type = searchParams.get("type") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = searchParams.get("limit") === "All" ? 99999 : parseInt(searchParams.get("limit") || "50");
        const skip = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...filter };
        if (status) where.status = status.toUpperCase();
        if (type) where.type = type.toUpperCase();
        if (search) {
            where.OR = [
                { recipient: { contains: search, mode: "insensitive" } },
                { message: { contains: search, mode: "insensitive" } },
            ];
        }

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

        // Compute summaries
        const allWhere = { ...filter };
        const [totalAll, totalSent, totalFailed, totalPending] = await Promise.all([
            prisma.smsMessage.count({ where: allWhere }),
            prisma.smsMessage.count({ where: { ...allWhere, status: "SENT" } }),
            prisma.smsMessage.count({ where: { ...allWhere, status: "FAILED" } }),
            prisma.smsMessage.count({ where: { ...allWhere, status: "PENDING" } }),
        ]);

        return jsonResponse({
            data: messages,
            total,
            page,
            limit,
            summaries: { total: totalAll, sent: totalSent, failed: totalFailed, pending: totalPending },
        });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/sms - send individual SMS
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const tenantId = getAssignTenantId(userPayload);
        const body = await req.json();

        if (!body.recipient || !body.message) {
            return errorResponse("Recipient and message are required");
        }

        const sms = await prisma.smsMessage.create({
            data: {
                clientId: body.clientId || null,
                recipient: body.recipient,
                message: body.message,
                type: body.type === "Broadcast" ? "BROADCAST" : "INDIVIDUAL",
                status: "SENT", // In real app this would be PENDING until SMS gateway confirms
                tenantId,
            },
        });

        return jsonResponse(sms, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
