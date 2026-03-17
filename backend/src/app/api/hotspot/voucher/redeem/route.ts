import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

/**
 * POST /api/hotspot/voucher/redeem
 * 
 * Called from the MikroTik hotspot login page when a client enters a voucher code.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { code, macAddress, routerId } = body;

        if (!code) {
            return errorResponse("Voucher code is required", 400);
        }

        // Find the voucher
        const voucher = await prisma.voucher.findUnique({
            where: { code },
            include: { package: true },
        });

        if (!voucher) {
            return errorResponse("Invalid voucher code", 404);
        }

        if (voucher.status !== "UNUSED") {
            return errorResponse(`Voucher is already ${voucher.status.toLowerCase()}`, 400);
        }

        // Validate router if voucher is locked to a router
        if (voucher.routerId && routerId && voucher.routerId !== routerId) {
             return errorResponse("This voucher is not valid for this router", 400);
        }

        const pkg = voucher.package;
        const now = new Date();
        const expiresAt = new Date(now);

        // Calculate expiration based on package duration
        switch (pkg.durationUnit) {
            case "MINUTES":
                expiresAt.setMinutes(expiresAt.getMinutes() + pkg.duration);
                break;
            case "HOURS":
                expiresAt.setHours(expiresAt.getHours() + pkg.duration);
                break;
            case "DAYS":
                expiresAt.setDate(expiresAt.getDate() + pkg.duration);
                break;
            case "MONTHS":
                expiresAt.setMonth(expiresAt.getMonth() + pkg.duration);
                break;
        }

        // Find or create client by MAC address
        let client = null;
        if (macAddress) {
            client = await prisma.client.findFirst({
                where: { macAddress },
            });
        }

        if (!client) {
            // Create a temporary client for the voucher
            const username = `V-${code}`;
            client = await prisma.client.create({
                data: {
                    username,
                    fullName: `Voucher User (${code})`,
                    phone: "0000000000",
                    serviceType: "HOTSPOT",
                    status: "ACTIVE",
                    macAddress: macAddress || null,
                },
            });
        }

        // Update voucher status and subscription in a transaction
        await prisma.$transaction([
            // 1. Mark voucher as USED
            prisma.voucher.update({
                where: { id: voucher.id },
                data: {
                    status: "USED",
                    usedBy: client.username,
                    usedAt: now,
                },
            }),
            // 2. Create subscription
            prisma.subscription.create({
                data: {
                    clientId: client.id,
                    packageId: pkg.id,
                    routerId: routerId || pkg.routerId || undefined,
                    status: "ACTIVE",
                    method: "VOUCHER",
                    activatedAt: now,
                    expiresAt,
                    onlineStatus: "ONLINE",
                    syncStatus: "SYNCED",
                },
            }),
            // 3. Update client
            prisma.client.update({
                where: { id: client.id },
                data: { status: "ACTIVE" },
            }),
        ]);

        return jsonResponse({
            success: true,
            message: "Voucher redeemed successfully!",
            username: client.username,
            password: "", // Vouchers usually don't have passwords in this flow, or it's the code itself
            expiresAt: expiresAt.toISOString(),
        });

    } catch (e) {
        console.error("VOUCHER REDEEM ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
