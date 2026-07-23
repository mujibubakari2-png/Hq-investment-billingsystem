import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";
import logger from "@/lib/logger";

/**
 * GET  /api/super-admin/notifications — list notification history
 * POST /api/super-admin/notifications — send email/SMS notification to tenant(s)
 */
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = 50;
        const skip = (page - 1) * limit;

        const [msgs, total] = await Promise.all([
            db.smsMessage.findMany({
                where: { type: "BROADCAST" },
                include: {
                    tenant: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db.smsMessage.count({ where: { type: "BROADCAST" } }),
        ]);

        return jsonResponse({
            data: msgs.map((m) => ({
                id: m.id,
                tenantId: m.tenantId,
                tenantName: m.tenant?.name ?? "All Tenants",
                recipient: m.recipient,
                message: m.message,
                status: m.status,
                type: m.type,
                createdAt: m.createdAt,
                sentAt: m.sentAt,
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (e) {
        logger.error("Super Admin GET Notifications Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        const { channel, tenantId, subject, message } = body;

        if (!channel || !message) {
            return errorResponse("channel and message are required", 400);
        }
        if (!["email", "broadcast"].includes(channel)) {
            return errorResponse("channel must be 'email' or 'broadcast'", 400);
        }

        // Get tenants to notify
        const tenants = await db.tenant.findMany({
            where: tenantId ? { id: tenantId } : {},
            select: { id: true, name: true, email: true, phone: true, status: true },
        });

        if (tenants.length === 0) {
            return errorResponse("No tenants found to notify", 404);
        }

        let successCount = 0;
        let failCount = 0;

        for (const tenant of tenants) {
            try {
                if (channel === "email") {
                    await sendEmail({
                        to: tenant.email,
                        subject: subject || "Platform Notification",
                        text: message,
                        html: `
                            <div style="font-family:sans-serif;padding:24px;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:12px">
                                <h2 style="color:#1a1a2e">Platform Notification</h2>
                                <p>Dear <strong>${tenant.name}</strong>,</p>
                                <div style="background:#f4f4f7;padding:20px;border-radius:8px;margin:16px 0;white-space:pre-wrap">${message}</div>
                                <p style="color:#999;font-size:12px">This is an official message from the HQ Investment Platform.</p>
                            </div>
                        `,
                    });
                }

                // Log it
                await db.smsMessage.create({
                    data: {
                        tenantId: tenant.id,
                        recipient: tenant.email,
                        message,
                        status: "SENT",
                        type: "BROADCAST" as const,
                        sentAt: new Date(),
                    },
                });
                successCount++;
            } catch (err) {
                logger.warn(`Notification failed for tenant ${tenant.id}`, { error: String(err) });
                failCount++;
            }
        }

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_SEND_NOTIFICATION",
            resource: "SmsMessage",
            details: { channel, tenantId: tenantId || "all", subject, successCount, failCount },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({
            message: `Notification sent to ${successCount} tenant(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
            successCount,
            failCount,
        });
    } catch (e) {
        logger.error("Super Admin POST Notification Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
