import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

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

        if (!reference) {
            return errorResponse("Reference is required", 400);
        }
        if (!routerId) {
            return errorResponse("routerId is required", 400);
        }

        const router = await prisma.router.findUnique({
            where: { id: routerId },
            select: { id: true, tenantId: true },
        });
        if (!router) {
            return errorResponse("Router not found", 404);
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

        // Build response
        const response: Record<string, unknown> = {
            status: transaction.status,
            reference: transaction.reference,
            amount: transaction.amount,
            packageName: transaction.planName,
        };

        if (transaction.status === "COMPLETED") {
            // Find the active subscription
            const subscription = await db.subscription.findFirst({
                where: {
                    clientId: transaction.clientId,
                    status: "ACTIVE",
                },
                orderBy: { createdAt: "desc" },
            });

            response.username = transaction.client.username;
            response.expiresAt = subscription?.expiresAt?.toISOString() || transaction.expiryDate?.toISOString();
            response.message = "Payment confirmed! You can now connect.";
            response.autoConnect = true;
        } else if (transaction.status === "FAILED") {
            response.message = "Payment failed. Please try again.";
        } else {
            response.message = "Waiting for payment confirmation...";
        }

        return jsonResponse(response);

    } catch (e) {
        console.error("HOTSPOT STATUS ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
