import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { suspendRadiusUser } from "@/lib/radius";
import { toISOSafe } from "@/lib/dateUtils";

/**
 * POST /api/radius/voucher-expire
 *
 * Marks expired voucher-based subscriptions in the database and suspends
 * the corresponding RADIUS users so MikroTik immediately blocks their access.
 *
 * A subscription is expired when:
 *   - status = "ACTIVE"
 *   - expiresAt <= now
 *   - method = "VOUCHER" (voucher-based subscriptions only)
 *
 * Safe to call on a schedule (e.g., every hour via a cron job).
 */
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const tenantFilter = { tenantId: userPayload.tenantId };
        const now = new Date();

        // 1. Find all ACTIVE voucher subscriptions that have expired
        //    Use select-only (no include) to avoid the Prisma include+select conflict
        const expiredVoucherSubs = await db.subscription.findMany({
            where: {
                ...tenantFilter,
                status: "ACTIVE",
                method: "VOUCHER",
                expiresAt: { lte: now },
            },
            select: {
                id: true,
                expiresAt: true,
                client: {
                    select: { username: true },
                },
            },
        });

        if (expiredVoucherSubs.length === 0) {
            return jsonResponse({
                success: true,
                message: "No expired voucher subscriptions found.",
                processed: 0,
            });
        }

        const results: { username: string; status: string; error?: string }[] = [];

        for (const sub of expiredVoucherSubs) {
            const username = sub.client?.username;
            if (!username) continue;

            try {
                // 2. Mark subscription as EXPIRED in the database
                await db.subscription.update({
                    where: { id: sub.id },
                    data: { status: "EXPIRED", onlineStatus: "OFFLINE" },
                });

                // 3. Suspend the user in RADIUS — sets Expiration to past
                //    so FreeRADIUS immediately rejects new auth attempts
                await suspendRadiusUser(username, tenantFilter.tenantId ?? null);

                results.push({ username, status: "expired" });
            } catch (err) {
                console.error(`[VOUCHER EXPIRE] Failed for ${username}:`, err);
                results.push({ username, status: "error", error: String(err) });
            }
        }

        const succeeded = results.filter(r => r.status === "expired").length;
        const failed = results.filter(r => r.status === "error").length;

        return jsonResponse({
            success: true,
            message: `Processed ${expiredVoucherSubs.length} expired voucher subscriptions.`,
            processed: expiredVoucherSubs.length,
            succeeded,
            failed,
            results,
        });

    } catch (e) {
        console.error("[VOUCHER EXPIRE ERROR]:", e);
        return errorResponse("Internal server error", 500);
    }
}

/**
 * GET /api/radius/voucher-expire
 *
 * Preview which voucher subscriptions are currently expired
 * without making any changes.
 */
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);

        const tenantFilter = { tenantId: userPayload.tenantId };
        const now = new Date();

        // Use select-only (never mix include + select — Prisma disallows it)
        const expiredVoucherSubs = await db.subscription.findMany({
            where: {
                ...tenantFilter,
                status: "ACTIVE",
                method: "VOUCHER",
                expiresAt: { lte: now },
            },
            select: {
                id: true,
                expiresAt: true,
                method: true,
                client: {
                    select: { username: true, fullName: true },
                },
                package: {
                    select: { name: true },
                },
            },
            orderBy: { expiresAt: "asc" },
        });

        return jsonResponse({
            count: expiredVoucherSubs.length,
            subscriptions: expiredVoucherSubs.map(s => ({
                id: s.id,
                username: s.client?.username || "Unknown",
                fullName: s.client?.fullName || "",
                plan: s.package?.name || "N/A",
                expiresAt: toISOSafe(s.expiresAt),
                method: s.method,
            })),
        });

    } catch (e) {
        console.error("[VOUCHER EXPIRE GET ERROR]:", e);
        return errorResponse("Internal server error", 500);
    }
}
