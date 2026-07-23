import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/tenant";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";

/**
 * GET /api/admin/sms
 *
 * Lists SMS messages (platform-scoped, no individual client content exposed).
 *
 * NOTE: Use /api/super-admin/notifications for the new recommended API.
 * This route is kept for backward compatibility only.
 *
 * ── SECURITY FIX ──────────────────────────────────────────────────────────────
 * Added isPlatformSuperAdmin() check — prevents tenant SUPER_ADMINs from
 * reading SMS messages across all tenants.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (!isPlatformSuperAdmin(guard.user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"));
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            db.smsMessage.findMany({
                select: {
                    id: true,
                    recipient: true,
                    // ── PRIVACY: Expose message only at summary level, not client-personal data ──
                    message: true,
                    status: true,
                    type: true,
                    sentAt: true,
                    createdAt: true,
                    tenantId: true,
                    // ── PRIVACY: Only tenant name, no individual client identity ──
                    tenant: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db.smsMessage.count(),
        ]);

        const mapped = messages.map(msg => ({
            id: msg.id,
            tenantName: msg.tenant?.name ?? "Platform",
            recipient: msg.recipient,
            message: msg.message,
            status: msg.status,
            type: msg.type,
            sentAt: msg.sentAt,
            createdAt: msg.createdAt,
        }));

        return jsonResponse({ data: mapped, total, page, pages: Math.ceil(total / limit) });
    } catch (e) {
        logger.error("ADMIN SMS FETCH ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

/**
 * POST /api/admin/sms
 *
 * NOTE: Use /api/super-admin/notifications for the new recommended API.
 * This route is kept for backward compatibility only.
 */
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (!isPlatformSuperAdmin(guard.user)) return errorResponse("Forbidden: Platform Super Admin Only", 403);

        const db = getTenantClient(null);
        const body = await req.json();
        const { recipient, message, tenantId } = body;

        if (!recipient || !message) {
            return errorResponse("Recipient and message are required", 400);
        }

        // If tenantId provided, verify it exists
        if (tenantId) {
            const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
            if (!tenant) return errorResponse("Tenant not found", 404);
        }

        const sms = await db.smsMessage.create({
            data: {
                recipient,
                message,
                status: "PENDING",
                type: "INDIVIDUAL" as const,
                tenantId: tenantId || null,
            },
        });

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_SEND_SMS",
            resource: "SmsMessage",
            resourceId: sms.id,
            details: { recipient, tenantId: tenantId || "global" },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({ message: "SMS message queued", sms }, 201);
    } catch (e) {
        logger.error("ADMIN SMS ACTION ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
