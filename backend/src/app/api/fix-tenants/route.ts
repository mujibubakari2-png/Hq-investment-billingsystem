import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { requireRole } from "@/lib/rbac";
import { isPlatformSuperAdmin } from "@/lib/tenant";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;

        // ── CRITICAL SECURITY FIX ───────────────────────────────────
        // Without this check, ANY tenant-level SUPER_ADMIN can activate
        // or extend licenses for ALL tenants on the platform.
        if (!isPlatformSuperAdmin(guard.user)) {
            return NextResponse.json({ error: "Forbidden: Platform Super Admin Only" }, { status: 403 });
        }

        const user = guard.user;
        const db = getTenantClient(null);

        logger.info("Checking for stuck tenants with PAID invoices...");

        const tenants = await db.tenant.findMany({
            include: {
                tenantInvoices: true
            }
        });

        let fixedCount = 0;

        for (const tenant of tenants) {
            // If tenant is still SUSPENDED or PENDING_APPROVAL, but has an invoice marked PAID
            if (tenant.status !== 'ACTIVE') {
                const hasPaid = tenant.tenantInvoices.some((inv: any) => inv.status === 'PAID');

                if (hasPaid) {
                    logger.info(`Fixing tenant ${tenant.name} (${tenant.id})`);

                    const now = new Date();

                    let totalPaidMonths = 0;
                    for (const inv of tenant.tenantInvoices.filter((i: any) => i.status === 'PAID')) {
                        totalPaidMonths += (inv.packageMonths || 1);
                    }

                    let newExpiry = tenant.licenseExpiresAt || now;
                    if (newExpiry < now) {
                        newExpiry = new Date(now);
                    }
                    newExpiry.setMonth(newExpiry.getMonth() + totalPaidMonths);

                    await db.tenant.update({
                        where: { id: tenant.id },
                        data: {
                            status: 'ACTIVE',
                            licenseExpiresAt: newExpiry
                        }
                    });

                    fixedCount++;
                }
            } else {
                // Also fix active ones whose license hasn't been extended but they paid.
                const paidInvoices = tenant.tenantInvoices.filter((i: any) => i.status === 'PAID');
                if (paidInvoices.length > 0 && tenant.licenseExpiresAt) {
                    const now = new Date();
                    if (tenant.licenseExpiresAt < now) {
                        logger.info(`Fixing active tenant with expired date but PAID invoices: ${tenant.name}`);

                        let sumMonths = 0;
                        for (const inv of paidInvoices) sumMonths += (inv.packageMonths || 1);

                        let updatedExpiry = new Date(now);
                        updatedExpiry.setMonth(updatedExpiry.getMonth() + sumMonths);

                        await db.tenant.update({
                            where: { id: tenant.id },
                            data: { licenseExpiresAt: updatedExpiry }
                        });
                        fixedCount++;
                    }
                }
            }
        }

        await writeAuditLog({
            tenantId: "platform",
            userId: user.userId,
            action: "PLATFORM_FIX_TENANTS",
            resource: "Tenant",
            details: { fixedCount },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return NextResponse.json({ message: `Finished fixing tenants. Total fixed: ${fixedCount}` });
    } catch (e: any) {
        logger.error("FIX TENANT ERROR", { error: e instanceof Error ? e.message : String(e) });
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
