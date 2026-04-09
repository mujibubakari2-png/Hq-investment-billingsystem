import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // ── Security: SUPER_ADMIN only ────────────────────────────────────────
        const user = getUserFromRequest(req);
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        console.log("Checking for stuck tenants with PAID invoices...");

        const tenants = await prisma.tenant.findMany({
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
                    console.log(`Fixing tenant ${tenant.name} (${tenant.id})`);
                    
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

                    await prisma.tenant.update({
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
                        console.log(`Fixing active tenant with expired date but PAID invoices: ${tenant.name}`);
                        
                        let sumMonths = 0;
                        for (const inv of paidInvoices) sumMonths += (inv.packageMonths || 1);

                        let updatedExpiry = new Date(now);
                        updatedExpiry.setMonth(updatedExpiry.getMonth() + sumMonths);

                        await prisma.tenant.update({
                            where: { id: tenant.id },
                            data: { licenseExpiresAt: updatedExpiry }
                        });
                        fixedCount++;
                    }
                }
            }
        }

        return NextResponse.json({ message: `Finished fixing tenants. Total fixed: ${fixedCount}` });
    } catch (e: any) {
        console.error("FIX TENANT ERROR", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
