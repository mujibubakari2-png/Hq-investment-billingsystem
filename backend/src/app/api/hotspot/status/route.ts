import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
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

        if (!reference) {
            return errorResponse("Reference is required", 400);
        }

        const transaction = await prisma.transaction.findFirst({
            where: { reference },
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
            const subscription = await prisma.subscription.findFirst({
                where: {
                    clientId: transaction.clientId,
                    status: "ACTIVE",
                },
                orderBy: { createdAt: "desc" },
            });

            response.username = transaction.client.username;
            response.password = transaction.client.phone; // Phone as default password
            response.expiresAt = subscription?.expiresAt?.toISOString() || transaction.expiryDate;
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
