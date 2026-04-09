import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getMikroTikService } from "@/lib/mikrotik";

export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = { tenantId: userPayload.tenantId };

        const body = await req.json();
        const { subscriptionIds, durationDays = 30 } = body;

        if (!subscriptionIds || !Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
            return errorResponse("Please select at least one expired subscriber to bulk extend.");
        }

        const subs = await prisma.subscription.findMany({
            where: { id: { in: subscriptionIds }, status: "EXPIRED", ...tenantFilter },
            include: { client: true, package: true, router: true },
        });

        if (subs.length === 0) {
            return errorResponse("No valid expired subscriptions found to extend.");
        }

        const newExpiresDate = new Date();
        newExpiresDate.setDate(newExpiresDate.getDate() + durationDays);

        const successes = [];
        const failures = [];

        for (const sub of subs) {
            try {
                if (!sub.routerId || !sub.client || !sub.package) {
                    throw new Error("Missing critical relations (router, client, package)");
                }

                // Activate on Mikrotik
                const mikrotik = await getMikroTikService(sub.routerId);
                const pwd = sub.client.phone || "123456";
                const type = sub.client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                await mikrotik.activateService(sub.client.username, pwd, sub.package.name, type);

                // Update database
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: {
                        status: "ACTIVE",
                        syncStatus: "SYNCED",
                        expiresAt: newExpiresDate,
                    }
                });

                // Record log
                await prisma.routerLog.create({
                    data: {
                        routerId: sub.routerId,
                        action: "BULK_EXTEND_SUCCESS",
                        details: `Admin bulk extended ${type} plan ${sub.package.name}`,
                        status: "success",
                        username: sub.client.username
                    }
                });

                successes.push(sub.client.username);
            } catch (err: any) {
                console.error(`Bulk extend specific error on ${sub.id}:`, err);
                // Mark DB
                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: {
                        syncStatus: "FAILED_SYNC"
                    }
                });
                
                if (sub.routerId && sub.client) {
                    await prisma.routerLog.create({
                        data: {
                            routerId: sub.routerId,
                            action: "BULK_EXTEND_FAILED",
                            details: `Bulk extend failed: ${err.message}`,
                            status: "error",
                            username: sub.client.username
                        }
                    });
                }
                failures.push({ username: sub.client?.username, error: err.message });
            }
        }

        return jsonResponse({
            message: `Bulk extension complete. Success: ${successes.length}, Failed: ${failures.length}`,
            successes,
            failures
        });

    } catch (e) {
        console.error("Bulk extend generic error:", e);
        return errorResponse("Internal server error", 500);
    }
}
