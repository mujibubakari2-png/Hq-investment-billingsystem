import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { buildHotspotPortalFeedback } from "@/lib/hotspotFlow";
import { paymentService } from "@/lib/payments/service";
import { isSupportedProvider } from "@/lib/payments/registry";
import logger from "@/lib/logger";

/**
 * GET /api/hotspot/status?reference=HP-XXXXX
 * 
 * Called by the hotspot login page to poll for payment status.
 * Returns:
 * - PENDING: Payment is still being processed
 * - COMPLETED: Payment confirmed, user can connect (returns username/password)
 * - FAILED: Payment failed
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const reference = searchParams.get("reference");
        const routerId = searchParams.get("routerId") || searchParams.get("router_id");
        const providerParam = searchParams.get("provider");
        const providerRefParam = searchParams.get("providerRef") || searchParams.get("checkoutRequestId");

        if (!reference) {
            return errorResponse("Reference is required", 400);
        }
        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const lookupDb = getTenantClient(null);
        const router = await lookupDb.router.findUnique({
            where: { id: routerId },
            select: { id: true, tenantId: true },
        });
        if (!router) {
            return errorResponse("Router not found", 404);
        }
        if (!router.tenantId) {
            return errorResponse("Invalid router configuration", 400);
        }
        const db = getTenantClient(router.tenantId);

        const transaction = await db.transaction.findFirst({
            where: {
                reference,
                tenantId: router.tenantId,
            },
            include: {
                client: {
                    select: {
                        id: true,
                        username: true,
                        phone: true,
                        macAddress: true,
                    },
                },
            },
        });

        if (!transaction) {
            return errorResponse("Transaction not found", 404);
        }

        if (transaction.status === "PENDING") {
            const providerName = (providerParam || transaction.method || "").toUpperCase();
            const providerRef = providerRefParam || transaction.providerRef;
            if (providerName && providerRef && isSupportedProvider(providerName)) {
                try {
                    const liveStatus = await paymentService.checkStatus(providerName, providerRef, router.tenantId);
                    if (liveStatus.status === "COMPLETED") {
                        await paymentService.completeTenantTransactionFromStatus(
                            reference,
                            providerName,
                            providerRef,
                            liveStatus.amount
                        );
                        transaction.status = "COMPLETED";
                    } else if (liveStatus.status === "FAILED" || liveStatus.status === "EXPIRED") {
                        await db.transaction.update({
                            where: { id: transaction.id },
                            data: { status: liveStatus.status },
                        });
                        transaction.status = liveStatus.status;
                    }
                } catch (pollErr) {
                    logger.warn("[HOTSPOT STATUS] Live provider poll failed:", { error: pollErr instanceof Error ? pollErr.message : String(pollErr) });
                }
            }
        }

        // Build response
        const feedback = buildHotspotPortalFeedback({
            kind: 'payment',
            state: transaction.status === 'COMPLETED'
                ? 'success'
                : transaction.status === 'FAILED'
                    ? 'failed'
                    : 'pending',
        });

        const response: Record<string, unknown> = {
            status: transaction.status,
            reference: transaction.reference,
            amount: transaction.amount,
            packageName: transaction.planName,
            title: feedback.title,
            message: feedback.message,
            autoConnect: feedback.autoConnect,
        };

        if (transaction.status === "COMPLETED") {
            const subscription = await db.subscription.findFirst({
                where: {
                    clientId: transaction.clientId,
                    status: "ACTIVE",
                },
                orderBy: { createdAt: "desc" },
            });

            response.username = transaction.client.username;
            response.expiresAt = subscription?.expiresAt?.toISOString() || transaction.expiryDate?.toISOString();
        }

        return jsonResponse(response);

    } catch (e) {
        logger.error("HOTSPOT STATUS ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
