import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/sms - list all SMS messages across all tenants (Super Admin only)
export async function GET(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const messages = await prisma.smsMessage.findMany({
            include: {
                tenant: { select: { name: true } },
                client: { select: { fullName: true, username: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        const mapped = messages.map(msg => ({
            id: msg.id,
            tenant: msg.tenant?.name || "Global",
            recipient: msg.recipient,
            client: msg.client?.fullName || msg.client?.username || "N/A",
            message: msg.message,
            status: msg.status,
            type: msg.type,
            sentAt: msg.sentAt,
            createdAt: msg.createdAt
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error("ADMIN SMS FETCH ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/admin/sms - send global SMS (Super Admin only)
export async function POST(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Super Admin access required", 403);
        }

        const body = await req.json();
        const { recipient, message, tenantId } = body;

        if (!recipient || !message) {
            return errorResponse("Recipient and message are required", 400);
        }

        // Create the message in DB
        const sms = await prisma.smsMessage.create({
            data: {
                recipient,
                message,
                status: "PENDING",
                type: "INDIVIDUAL" as const,
                tenantId: tenantId || null // Can be global or for a specific tenant
            }
        });

        // Here we would normally trigger the SMS gateway
        // ... sms gateway call ...

        return jsonResponse({ message: "SMS message sent successfully", sms }, 201);
    } catch (e) {
        console.error("ADMIN SMS ACTION ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
