import { NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getMikroTikService } from "@/lib/mikrotik";
import { suspendRadiusUser } from "@/lib/radius";
import logger from "@/lib/logger";

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

    const expiredSubscriptions = await db.subscription.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      include: {
        client: true,
        package: true,
        router: true,
      },
      orderBy: { expiresAt: "asc" },
    });

    const results: Array<{ subscriptionId: string; username: string; status: string; error?: string }> = [];

    for (const sub of expiredSubscriptions as any[]) {
      const username = sub.client?.username;
      if (!username) {
        results.push({ subscriptionId: sub.id, username: "Unknown", status: "skipped", error: "Missing client username" });
        continue;
      }

      try {
        if (sub.routerId) {
          const mikrotik = await getMikroTikService(sub.routerId);
          const serviceType = sub.client?.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
          await mikrotik.suspendService(username, serviceType);
        }

        await suspendRadiusUser(username, sub.tenantId ?? null);

        await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: "EXPIRED",
            onlineStatus: "OFFLINE",
            syncStatus: "SYNCED",
          },
        });

        const otherActiveSubs = await db.subscription.count({
          where: {
            clientId: sub.clientId,
            id: { not: sub.id },
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
        });

        if (otherActiveSubs === 0) {
          await db.client.update({
            where: { id: sub.clientId },
            data: { status: "EXPIRED" },
          });
        }

        if (sub.routerId) {
          await db.routerLog.create({
            data: {
              routerId: sub.routerId,
              action: "AUTO_EXPIRE_SUBSCRIPTION",
              details: `Expired subscription ${sub.id} and suspended ${username}`,
              status: "success",
              username,
              tenantId: sub.tenantId,
            },
          }).catch(() => {});
        }

        results.push({ subscriptionId: sub.id, username, status: "expired" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: "EXPIRED",
            onlineStatus: "OFFLINE",
            syncStatus: "FAILED_SYNC",
          },
        }).catch(() => {});

        if (sub.routerId) {
          await db.routerLog.create({
            data: {
              routerId: sub.routerId,
              action: "AUTO_EXPIRE_SUBSCRIPTION_FAILED",
              details: message,
              status: "error",
              username,
              tenantId: sub.tenantId,
            },
          }).catch(() => {});
        }

        results.push({ subscriptionId: sub.id, username, status: "error", error: message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: expiredSubscriptions.length,
      expired: results.filter((r) => r.status === "expired").length,
      failed: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[CRON/EXPIRE-SUBSCRIPTIONS] Error:", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
