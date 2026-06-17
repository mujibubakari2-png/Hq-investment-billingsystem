import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";

// GET /api/sms
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "sms:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

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
            db.smsMessage.findMany({
                where,
                include: { client: { select: { username: true, fullName: true } } },
                orderBy: { sentAt: "desc" },
                skip,
                take: limit,
            }),
            db.smsMessage.count({ where }),
        ]);

        // Compute summaries
        const allWhere = { ...filter };
        const [totalAll, totalSent, totalFailed, totalPending] = await Promise.all([
            db.smsMessage.count({ where: allWhere }),
            db.smsMessage.count({ where: { ...allWhere, status: "SENT" } }),
            db.smsMessage.count({ where: { ...allWhere, status: "FAILED" } }),
            db.smsMessage.count({ where: { ...allWhere, status: "PENDING" } }),
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
        const guard = requirePermission(req, "sms:send");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const tenantId = getAssignTenantId(userPayload);
        const body = await req.json();

        if (!body.recipient || !body.message) {
            return errorResponse("Recipient and message are required");
        }

        const sms = await db.smsMessage.create({
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

