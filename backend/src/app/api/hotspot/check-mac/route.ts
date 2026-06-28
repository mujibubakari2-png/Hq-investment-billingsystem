import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { buildHotspotPortalFeedback } from "@/lib/hotspotFlow";

/**
 * GET /api/hotspot/check-mac?mac=XX:XX:XX:XX:XX:XX
 * 
 * Checks if a device with the given MAC address has an active hotspot subscription.
 * If yes, returns credentials for auto-connection.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const mac = searchParams.get("mac");
        const routerId = searchParams.get("routerId") || searchParams.get("router_id");

        if (!mac) {
            return errorResponse("MAC address is required", 400);
        }
        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const normalizedMac = mac.trim().toLowerCase();
        const isValidMac = /^([0-9a-f]{2}[:\-]){5}[0-9a-f]{2}$/.test(normalizedMac);
        if (!isValidMac) {
            return errorResponse("Invalid MAC address format", 400);
        }

        const globalDb = getTenantClient(null);
        const router = await globalDb.router.findUnique({
            where: { id: routerId },
            select: { id: true, tenantId: true },
        });
        if (!router) {
            return errorResponse("Router not found", 404);
        }
        const db = getTenantClient(router.tenantId);

        // Find an active subscription for this MAC address on the expected router.
        const subscription = await db.subscription.findFirst({
            where: {
                status: "ACTIVE",
                expiresAt: {
                    gt: new Date(),
                },
                tenantId: router.tenantId,
                client: {
                    macAddress: normalizedMac,
                },
                OR: [
                    { routerId },
                    { package: { routerId } },
                ],
            },
            include: {
                client: {
                    select: {
                        username: true,
                        phone: true,
                    },
                },
                package: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                expiresAt: "desc",
            },
        });

        if (!subscription) {
            return jsonResponse({
                active: false,
                title: 'No active subscription',
                message: 'No active subscription found',
                autoConnect: false,
            });
        }

        const feedback = buildHotspotPortalFeedback({ kind: 'reconnect', state: 'active' });
        let password = subscription.client.phone;
        if (subscription.method === "VOUCHER") {
            const lastVoucher = await db.voucher.findFirst({
                where: { usedBy: subscription.client.username, status: "USED", tenantId: router.tenantId },
                orderBy: { usedAt: "desc" },
            });

            if (lastVoucher) {
                password = lastVoucher.code;
            } else {
                // Legacy support for old voucher usernames that encoded the voucher code.
                const match = subscription.client.username.match(/^V-(.+)$/i);
                if (match) {
                    password = match[1];
                }
            }
        }

        return jsonResponse({
            active: true,
            title: feedback.title,
            message: feedback.message,
            autoConnect: feedback.autoConnect,
            username: subscription.client.username,
            password,
            expiresAt: subscription.expiresAt.toISOString(),
            packageName: subscription.package?.name || null,
        });

    } catch (e) {
        console.error("CHECK MAC ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
