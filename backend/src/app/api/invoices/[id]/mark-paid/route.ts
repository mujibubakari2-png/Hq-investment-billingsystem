import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { syncRadiusUser } from "@/lib/radius";
import { getMikroTikService } from "@/lib/mikrotik";
import { requireRole } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";

/**
 * INV-003: POST /api/invoices/[id]/mark-paid
 *
 * Manually mark an invoice as paid (cash / bank transfer / offline payment).
 * - Sets invoice status to PAID with paidAt timestamp
 * - Creates a MANUAL transaction record for audit trail
 * - Looks up package from invoice items and activates subscription
 * - Triggers RADIUS sync + MikroTik activation
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN", "ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const note = body.note as string | undefined;

        const invoice = await db.invoice.findUnique({
            where: { id },
            include: { client: true, items: true },
        });

        if (!invoice) return errorResponse("Invoice not found", 404);

        if (!canAccessTenant(userPayload, invoice.tenantId)) {
            return errorResponse("Forbidden", 403);
        }

        // INV-002: Status transition guard — cannot re-pay a PAID invoice
        if (invoice.status === "PAID") {
            return errorResponse("Invoice is already marked as paid", 409);
        }

        const now = new Date();
        const client = invoice.client;

        // Create a MANUAL transaction record for audit trail
        // NOTE: invoiceId is a new schema field — uses `as any` until prisma generate runs
        const transaction = await (db.transaction.create as any)({
            data: {
                clientId: client.id,
                planName: `Invoice ${invoice.invoiceNumber}`,
                amount: invoice.amount,
                type: "MANUAL",
                method: "CASH",
                status: "COMPLETED",
                reference: `MANUAL-${invoice.invoiceNumber}-${Date.now()}`,
                tenantId: invoice.tenantId,
                invoiceId: invoice.id,
            },
        });

        // Mark invoice PAID — paidAt and transactionId are new fields, use `as any` until regenerated
        await (db.invoice.update as any)({
            where: { id: invoice.id },
            data: {
                status: "PAID",
                paidAt: now,
                transactionId: transaction.id,
            },
        });

        // Activate subscription from invoice items
        const firstItem = invoice.items[0];
        let pkg = null;
        if (firstItem?.description) {
            pkg = await db.package.findFirst({
                where: {
                    OR: [
                        { name: firstItem.description },
                        { id: firstItem.description },
                    ],
                    ...(invoice.tenantId ? { tenantId: invoice.tenantId } : {}),
                },
            });
        }

        let newSub = null;
        if (pkg) {
            const expiresAt = new Date(now);
            switch (pkg.durationUnit) {
                case "MINUTES": expiresAt.setMinutes(expiresAt.getMinutes() + pkg.duration); break;
                case "HOURS": expiresAt.setHours(expiresAt.getHours() + pkg.duration); break;
                case "DAYS": expiresAt.setDate(expiresAt.getDate() + pkg.duration); break;
                case "MONTHS": expiresAt.setMonth(expiresAt.getMonth() + pkg.duration); break;
            }

            const existingSub = await db.subscription.findFirst({
                where: { clientId: client.id, packageId: pkg.id, status: "ACTIVE" },
            });

            if (existingSub) {
                newSub = await db.subscription.update({
                    where: { id: existingSub.id },
                    data: { expiresAt, syncStatus: "PENDING", onlineStatus: "ONLINE" },
                });
            } else {
                newSub = await db.subscription.create({
                    data: {
                        clientId: client.id,
                        packageId: pkg.id,
                        routerId: pkg.routerId ?? undefined,
                        status: "ACTIVE",
                        method: "CASH",
                        activatedAt: now,
                        expiresAt,
                        onlineStatus: "ONLINE",
                        syncStatus: "PENDING",
                        tenantId: invoice.tenantId,
                    },
                });
            }

            await db.client.update({
                where: { id: client.id },
                data: { status: "ACTIVE" },
            });

            // RADIUS sync
            try {
                let rateLimit: string | undefined;
                if (pkg.uploadSpeed && pkg.downloadSpeed) {
                    const ul = pkg.uploadUnit === "Mbps" ? "M" : "k";
                    const dl = pkg.downloadUnit === "Mbps" ? "M" : "k";
                    rateLimit = `${pkg.uploadSpeed}${ul}/${pkg.downloadSpeed}${dl}`;
                }
                await syncRadiusUser({
                    username: client.username,
                    password: client.phone || client.username,
                    tenantId: pkg.tenantId || null,
                    fullName: client.fullName || undefined,
                    expiresAt,
                    status: "Active",
                    rateLimit,
                    profileName: pkg.name,
                });
            } catch (radErr) {
                console.error("[Mark-Paid] RADIUS sync failed:", radErr);
                if (newSub?.id) {
                    await db.subscription.update({
                        where: { id: newSub.id },
                        data: { syncStatus: "PENDING_RADIUS_SYNC" },
                    }).catch(() => { });
                }
            }

            // MikroTik activation
            if (pkg.routerId) {
                try {
                    const mt = await getMikroTikService(pkg.routerId, invoice.tenantId);
                    const pwd = client.phone || "123456";
                    const type = client.serviceType === "HOTSPOT" ? "hotspot" : "pppoe";
                    await mt.activateService(client.username, pwd, pkg.name, type, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
                    if (newSub?.id) {
                        await db.subscription.update({
                            where: { id: newSub.id },
                            data: { syncStatus: "SYNCED" },
                        });
                    }
                } catch (mkErr: any) {
                    console.error("[Mark-Paid] MikroTik activation failed:", mkErr.message);
                }
            }
        }

        console.log(`✅ [Mark-Paid] Invoice ${invoice.invoiceNumber} marked paid by ${userPayload.username}${note ? ` — Note: ${note}` : ""}`);

        return jsonResponse({
            success: true,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            transactionId: transaction.id,
            subscriptionId: newSub?.id ?? null,
            paidAt: now,
            message: "Invoice marked as paid",
        });
    } catch (e) {
        console.error("[Mark-Paid] error:", e);
        return errorResponse("Internal server error", 500);
    }
}
