import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantFilter, getAssignTenantId } from "@/lib/tenant";
import logger from "@/lib/logger";
import { type Prisma, SmsStatus, SmsType } from "@/generated/prisma";

// Maximum recipients per bulk-SMS request (DoS guard)
const MAX_RECIPIENTS = 500;

// POST /api/sms/bulk - send bulk SMS
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "sms:send");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter } = getTenantFilter(userPayload);
        const tenantId = getAssignTenantId(userPayload);

        const body = await req.json();
        const { recipients, message, clientIds } = body;

        if (!message || typeof message !== "string" || message.trim().length === 0) {
            return errorResponse("Message is required");
        }
        if (message.length > 1600) {
            return errorResponse("Message exceeds 1600 character limit");
        }

        const records: Prisma.SmsMessageCreateManyInput[] = [];

        if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
            // DoS guard: cap clientIds batch size
            if (clientIds.length > MAX_RECIPIENTS) {
                return errorResponse(`clientIds batch exceeds maximum of ${MAX_RECIPIENTS}`, 400);
            }

            // HIGH-PERF FIX: Single query to fetch all clients, then build records array
            const clients = await db.client.findMany({
                where: { id: { in: clientIds }, ...filter },
                select: { id: true, phone: true },
            });

            for (const client of clients) {
                if (client.phone) {
                    records.push({
                        clientId: client.id,
                        recipient: client.phone,
                        message,
                        type:     SmsType.BROADCAST,
                        status:   SmsStatus.SENT,
                        tenantId,
                    });
                }
            }
        } else if (recipients && Array.isArray(recipients) && recipients.length > 0) {
            // DoS guard: cap recipients batch size
            if (recipients.length > MAX_RECIPIENTS) {
                return errorResponse(`recipients batch exceeds maximum of ${MAX_RECIPIENTS}`, 400);
            }

            for (const recipient of recipients) {
                if (recipient && typeof recipient === "string") {
                    records.push({ recipient, message, type: SmsType.BROADCAST, status: SmsStatus.SENT, tenantId });
                }
            }
        }

        if (records.length === 0) {
            return jsonResponse({ success: true, sent: 0, messages: [] }, 201);
        }

        // HIGH-PERF FIX: Single createMany() instead of one db.create per recipient.
        // Previously: a loop of N individual DB round-trips (N+1 anti-pattern).
        // createMany() sends a single INSERT with N rows — orders of magnitude faster.
        await db.smsMessage.createMany({ data: records, skipDuplicates: false });

        return jsonResponse({ success: true, sent: records.length }, 201);
    } catch (e) {
        logger.error('[sms/bulk] POST failed', { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
