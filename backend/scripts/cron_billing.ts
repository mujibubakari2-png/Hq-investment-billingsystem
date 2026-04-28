import prisma from "../src/lib/prisma";

/**
 * SaaS Billing & Tenant Management Job
 * 
 * This script handles:
 * 1. Trial expiration and initial invoice generation.
 * 2. Monthly recurring invoice generation for active tenants.
 * 3. Suspension of tenants with overdue invoices.
 */
async function runSaaSJob() {
    console.log(`[${new Date().toISOString()}] Starting SaaS Billing Job...`);
    const now = new Date();

    try {
        // --- 1. TRIAL EVALUATION ---
        console.log("Checking for expired trials...");
        const expiredTrials = await prisma.tenant.findMany({
            where: {
                status: "TRIALLING",
                trialEnd: { lt: now }
            },
            include: { plan: true }
        });

        for (const tenant of expiredTrials) {
            console.log(`Trial expired for tenant: ${tenant.name} (${tenant.id})`);
            
            await prisma.$transaction(async (tx) => {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7); // 7 days grace period

                await tx.tenantInvoice.create({
                    data: {
                        invoiceNumber: `INV-TRIAL-${Date.now()}-${tenant.id.slice(0, 4)}`,
                        tenantId: tenant.id,
                        planId: tenant.planId,
                        amount: tenant.plan.price,
                        dueDate: dueDate,
                        status: "PENDING"
                    }
                });

                await tx.tenant.update({
                    where: { id: tenant.id },
                    data: { status: "ACTIVE" } // Transition to active status once trial ends
                });
            });
            console.log(`Initial invoice generated for ${tenant.name}.`);
        }

        // --- 2. MONTHLY INVOICE GENERATION ---
        console.log("Checking for monthly recurring invoices...");
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeTenants = await prisma.tenant.findMany({
            where: { status: "ACTIVE" },
            include: { 
                plan: true, 
                tenantInvoices: { 
                    orderBy: { createdAt: 'desc' }, 
                    take: 1 
                } 
            }
        });

        for (const tenant of activeTenants) {
            const lastInvoice = tenant.tenantInvoices[0];
            
            // Generate new invoice if no invoice exists or last one is older than 30 days
            if (!lastInvoice || lastInvoice.createdAt < thirtyDaysAgo) {
                console.log(`Generating monthly invoice for tenant: ${tenant.name}`);
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 5);

                await prisma.tenantInvoice.create({
                    data: {
                        invoiceNumber: `INV-REC-${Date.now()}-${tenant.id.slice(0, 4)}`,
                        tenantId: tenant.id,
                        planId: tenant.planId,
                        amount: tenant.plan.price,
                        dueDate: dueDate,
                        status: "PENDING"
                    }
                });
            }
        }

        // --- 3. SERVICE SUSPENSION (OVERDUE INVOICES) ---
        console.log("Checking for overdue invoices...");
        const overdueInvoices = await prisma.tenantInvoice.findMany({
            where: {
                status: "PENDING",
                dueDate: { lt: now },
                tenant: { status: "ACTIVE" }
            },
            include: { tenant: true }
        });

        for (const invoice of overdueInvoices) {
            console.log(`Invoice ${invoice.invoiceNumber} is overdue. Suspending tenant: ${invoice.tenant.name}`);
            await prisma.tenant.update({
                where: { id: invoice.tenantId },
                data: { status: "SUSPENDED" }
            });
        }

        console.log(`[${new Date().toISOString()}] SaaS Job completed successfully.`);
    } catch (error: any) {
        console.error("[Fatal Error] SaaS Job failed:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the job
runSaaSJob();
