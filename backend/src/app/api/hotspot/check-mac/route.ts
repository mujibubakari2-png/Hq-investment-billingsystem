import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

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

        if (!mac) {
            return errorResponse("MAC address is required", 400);
        }

        // Find an active subscription for this MAC address
        const subscription = await prisma.subscription.findFirst({
            where: {
                client: {
                    macAddress: mac,
                },
                status: "ACTIVE",
                expiresAt: {
                    gt: new Date(),
                },
            },
            include: {
                client: {
                    select: {
                        username: true,
                        phone: true,
                    },
                },
            },
            orderBy: {
                expiresAt: "desc",
            },
        });

        if (!subscription) {
            return jsonResponse({ active: false, message: "No active subscription found" });
        }

        // Determine correct password
        let password = subscription.client.phone; // default for Mobile purchases
        
        if (subscription.method === "VOUCHER") {
            // Find the most recently used voucher by this client
            const lastVoucher = await prisma.voucher.findFirst({
                where: { usedBy: subscription.client.username, status: "USED" },
                orderBy: { usedAt: "desc" }
            });
            
            if (lastVoucher) {
                password = lastVoucher.code;
            } else if (subscription.client.username.startsWith("V-")) {
                password = subscription.client.username.substring(2); // Fallback to extraction
            }
        }

        return jsonResponse({
            active: true,
            username: subscription.client.username,
            password: password,
            expiresAt: subscription.expiresAt.toISOString(),
            packageName: subscription.packageId,
        });

    } catch (e) {
        console.error("CHECK MAC ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
