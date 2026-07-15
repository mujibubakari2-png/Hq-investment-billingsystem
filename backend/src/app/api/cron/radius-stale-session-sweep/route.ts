import { NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getMikroTikService } from "@/lib/mikrotik";
import logger from "@/lib/logger";

/**
 * GET /api/cron/radius-stale-session-sweep
 *
 * AUDIT REPORT POINT #8 — "Session Management haipo":
 *   Client disconnected → Reconnect → Power outage → NAS reboot →
 *   Duplicate login → MAC changed
 *
 * FreeRADIUS only closes a radacct row (sets acctstoptime) when the NAS
 * (MikroTik) sends an Accounting-Stop packet. If the router loses power,
 * reboots uncleanly, or the WAN/VPN link drops mid-session, that packet is
 * NEVER sent — the radacct row stays open (acctstoptime IS NULL) forever.
 * Every part of this app that treats "acctstoptime IS NULL" as "online"
 * (/api/radius/sessions, /api/radius/sync-online, /api/active-subscribers)
 * then shows that customer as permanently online even though they've been
 * disconnected for hours or days.
 *
 * This sweep cross-checks the DATABASE'S belief ("session is open") against
 * the ROUTER'S live reality ("is this username actually in /ppp/active or
 * /ip/hotspot/active right now?") and closes out anything stale:
 *
 *   - Router is OFFLINE (per Router.status, updated by testConnection()/
 *     health checks) → everything attributed to it is closed immediately,
 *     no need to even attempt a connection.
 *   - Router is ONLINE → live-query its active sessions and close any
 *     radacct row for a username that isn't actually connected anymore.
 *
 * Closed sessions get acctstoptime=now, acctterminatecause="Lost-Carrier"
 * (the standard RADIUS cause for an unexpected link loss), and
 * acctsessiontime computed from acctstarttime. The matching subscription's
 * onlineStatus is flipped to OFFLINE so dashboards reflect reality again.
 *
 * Safe to run on a schedule (e.g. every 10 minutes via cron), same pattern
 * as /api/cron/expire-subscriptions.
 */

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

    // Every ACTIVE subscription the DB currently believes is ONLINE, grouped
    // by router so we only need one live query per router.
    const onlineSubs = await db.subscription.findMany({
      where: { status: "ACTIVE", onlineStatus: "ONLINE", routerId: { not: null } },
      select: {
        id: true,
        routerId: true,
        tenantId: true,
        client: { select: { username: true } },
      },
    });

    if (onlineSubs.length === 0) {
      return NextResponse.json({ success: true, message: "No online subscriptions to check.", processed: 0 });
    }

    const byRouter = new Map<string, typeof onlineSubs>();
    for (const sub of onlineSubs) {
      if (!sub.routerId) continue;
      const list = byRouter.get(sub.routerId) ?? [];
      list.push(sub);
      byRouter.set(sub.routerId, list);
    }

    let closedSessions = 0;
    let flippedOffline = 0;
    let routersChecked = 0;
    let routersSkipped = 0;
    const errors: { routerId: string; error: string }[] = [];

    async function closeStaleUsername(username: string, tenantId: string | null) {
      // A username can (rarely) have more than one open radacct row if a
      // prior Accounting-Stop was also missed — close ALL open rows for it.
      const openRows = await db.radAcct.findMany({
        where: { username, acctstoptime: null, ...(tenantId ? { tenantId } : {}) },
        select: { radacctid: true, acctstarttime: true },
      });

      for (const row of openRows) {
        const sessionSeconds = row.acctstarttime
          ? Math.max(0, Math.floor((now.getTime() - row.acctstarttime.getTime()) / 1000))
          : null;
        await db.radAcct.update({
          where: { radacctid: row.radacctid },
          data: {
            acctstoptime: now,
            acctterminatecause: "Lost-Carrier",
            ...(sessionSeconds !== null ? { acctsessiontime: sessionSeconds } : {}),
          },
        }).catch(() => {});
        closedSessions++;
      }
    }

    for (const [routerId, subs] of byRouter.entries()) {
      const router = await db.router.findUnique({
        where: { id: routerId },
        select: { id: true, status: true, tenantId: true, accountingEnabled: true },
      });
      if (!router) { routersSkipped++; continue; }

      try {
        if (router.status === "OFFLINE") {
          // Shortcut: router is already known offline — no live check needed,
          // every session attributed to it is definitely stale.
          for (const sub of subs) {
            const username = sub.client?.username;
            if (!username) continue;
            await closeStaleUsername(username, router.tenantId ?? null);
            await db.subscription.update({ where: { id: sub.id }, data: { onlineStatus: "OFFLINE" } }).catch(() => {});
            flippedOffline++;
          }
          routersChecked++;
          continue;
        }

        // Router claims to be online — verify against its LIVE active session list.
        const service = await getMikroTikService(routerId, router.tenantId ?? null);
        const liveSessions = await service.listAllActiveSessions();
        const liveUsernames = new Set(liveSessions.map((s) => s.user));

        for (const sub of subs) {
          const username = sub.client?.username;
          if (!username) continue;
          if (!liveUsernames.has(username)) {
            await closeStaleUsername(username, router.tenantId ?? null);
            await db.subscription.update({ where: { id: sub.id }, data: { onlineStatus: "OFFLINE" } }).catch(() => {});
            flippedOffline++;
          }
        }
        routersChecked++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[RADIUS STALE SWEEP] Failed to check router", { routerId, error: message });
        errors.push({ routerId, error: message });
        routersSkipped++;
        // Do NOT assume stale on a connection error — a router that's merely
        // slow to respond right now is not the same as a confirmed-offline
        // or confirmed-disconnected router. Leave those subscriptions alone
        // this run; they'll be re-checked next sweep.
      }
    }

    return NextResponse.json({
      success: true,
      onlineSubscriptionsChecked: onlineSubs.length,
      routersChecked,
      routersSkipped,
      closedSessions,
      flippedOffline,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[CRON/RADIUS-STALE-SESSION-SWEEP] Error:", { error: message });
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
