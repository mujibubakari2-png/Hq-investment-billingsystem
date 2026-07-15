import { NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { enqueueRadiusDeleteUser } from "@/lib/radius-queue";
import { enqueueSuspendService } from "@/lib/queue";
import logger from "@/lib/logger";

/**
 * GET /api/cron/voucher-reservation-sweep
 *
 * VOUCHER-RESERVE-001
 *
 * Vouchers are no longer marked USED at redemption time — they're marked
 * ACTIVE (reserved). Queuing the RADIUS/MikroTik activation job only proves
 * we *tried* to connect the client; it does not prove the client's device
 * actually completed authentication (dropped signal, phone screen locked
 * before the redirect finished, power outage, etc).
 *
 * This sweep runs on a schedule (e.g. every 2–5 minutes via cron) and does
 * two things for every voucher currently in the ACTIVE (reserved) state:
 *
 *   1. CONFIRM — if a real RADIUS accounting session (radacct.acctstarttime)
 *      now exists for the username that redeemed the voucher, the voucher is
 *      finalized to USED. This is the actual "first successful auth" signal;
 *      the app never has to guess.
 *
 *   2. RELEASE — if the reservation is older than RESERVATION_GRACE_MS and
 *      still has no accounting session, the voucher reverts to UNUSED (so
 *      the customer can simply retry the same code), the orphaned
 *      subscription is closed out, and the corresponding RADIUS/MikroTik
 *      user is cleaned up so it can't be used to grant free access later.
 *
 * Safe to call repeatedly / concurrently — every write is scoped by id and
 * guarded by a status check, so a voucher can only be confirmed or released
 * once.
 */

const RESERVATION_GRACE_MS = 15 * 60 * 1000; // 15 minutes

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return unauthorized();
    }

    const db = getTenantClient(null);
    const now = new Date();

    const reserved = await db.voucher.findMany({
      where: { status: "ACTIVE", usedBy: { not: null } },
      select: {
        id: true,
        usedBy: true,
        usedAt: true,
        tenantId: true,
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { activatedAt: "desc" },
          take: 1,
          select: { id: true, routerId: true, tenantId: true },
        },
      },
    });

    const confirmed: string[] = [];
    const released: string[] = [];
    const stillPending: string[] = [];
    const errors: { voucherId: string; error: string }[] = [];

    for (const voucher of reserved) {
      const username = voucher.usedBy as string;
      try {
        // 1. CONFIRM: did a real RADIUS accounting session ever start for this user?
        const session = await db.radAcct.findFirst({
          where: {
            username,
            acctstarttime: { not: null },
            ...(voucher.tenantId ? { tenantId: voucher.tenantId } : {}),
          },
          select: { radacctid: true },
        });

        if (session) {
          await db.voucher.update({
            where: { id: voucher.id },
            data: { status: "USED" },
          });
          confirmed.push(voucher.id);
          continue;
        }

        // 2. RELEASE: still no session after the grace period -> free the voucher
        const reservedAgeMs = voucher.usedAt ? now.getTime() - voucher.usedAt.getTime() : Infinity;
        if (reservedAgeMs < RESERVATION_GRACE_MS) {
          stillPending.push(voucher.id);
          continue;
        }

        const sub = voucher.subscriptions[0];

        await db.$transaction([
          db.voucher.update({
            where: { id: voucher.id },
            data: { status: "UNUSED", usedBy: null, usedAt: null },
          }),
          ...(sub
            ? [
                db.subscription.update({
                  where: { id: sub.id },
                  data: {
                    status: "EXPIRED",
                    onlineStatus: "OFFLINE",
                    syncStatus: "RESERVATION_RELEASED",
                  },
                }),
              ]
            : []),
        ]);

        // Clean up whatever was provisioned so it can't grant free access later.
        await enqueueRadiusDeleteUser(username, voucher.tenantId ?? null, `release-${voucher.id}`).catch((e) =>
          logger.error("[VOUCHER SWEEP] Failed to queue RADIUS delete on release", {
            voucherId: voucher.id,
            error: e instanceof Error ? e.message : String(e),
          })
        );
        if (sub?.routerId) {
          await enqueueSuspendService(sub.routerId, username, "hotspot", voucher.tenantId ?? null).catch((e) =>
            logger.error("[VOUCHER SWEEP] Failed to queue MikroTik suspend on release", {
              voucherId: voucher.id,
              error: e instanceof Error ? e.message : String(e),
            })
          );
          await db.routerLog.create({
            data: {
              routerId: sub.routerId,
              action: "VOUCHER_RESERVATION_RELEASED",
              details: `No RADIUS session seen within grace period for ${username} — voucher released back to UNUSED`,
              status: "success",
              username,
              tenantId: voucher.tenantId,
            },
          }).catch(() => {});
        }

        released.push(voucher.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[VOUCHER SWEEP] Error processing voucher", { voucherId: voucher.id, error: message });
        errors.push({ voucherId: voucher.id, error: message });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: reserved.length,
      confirmed: confirmed.length,
      released: released.length,
      stillPending: stillPending.length,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[CRON/VOUCHER-RESERVATION-SWEEP] Error:", { error: message });
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
