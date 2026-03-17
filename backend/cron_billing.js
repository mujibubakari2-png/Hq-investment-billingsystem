const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runCronJobs() {
    console.log(`[${new Date().toISOString()}] Starting SaaS Billing Cron Jobs...`);
    const now = new Date();

    try {
        // --- 1. TRIAL EVALUATION ---
        console.log("Evaluating expired trials...");
        // Find tenants whose trial has ended but are still marked as TRIALLING
        const expiredTrials = await prisma.tenant.findMany({
            where: {
                status: "TRIALLING",
                trialEnd: { lt: now }
            },
            include: { plan: true }
        });

        for (const tenant of expiredTrials) {
            console.log(`Trial expired for tenant ${tenant.id}. Generating first invoice...`);
            
            await prisma.$transaction(async (tx) => {
                // Calculate due date (e.g., 5 days from now)
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 5);

                // Create the first invoice
                await tx.tenantInvoice.create({
                    data: {
                        invoiceNumber: `INV-${Date.now()}-${tenant.id.substring(0, 4)}`,
                        tenantId: tenant.id,
                        planId: tenant.planId,
                        amount: tenant.plan.price,
                        dueDate: dueDate,
                        status: "PENDING"
                    }
                });

                // Set tenant status to ACTIVE (or you could set to a grace period status)
                // For now, we leave them ACTIVE until the invoice is overdue.
                await tx.tenant.update({
                    where: { id: tenant.id },
                    data: { status: "ACTIVE" }
                });
            });
        }

        // --- 2. MONTHLY INVOICE GENERATION ---
        console.log("Checking for monthly invoice generation...");
        // In a real system, you'd check the last invoice date. 
        // Here we find ACTIVE tenants who don't have a PENDING invoice and their last invoice was > 30 days ago.
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activeTenants = await prisma.tenant.findMany({
            where: { status: "ACTIVE" },
            include: { plan: true, tenantInvoices: { orderBy: { createdAt: 'desc' }, take: 1 } }
        });

        for (const tenant of activeTenants) {
            const lastInvoice = tenant.tenantInvoices[0];
            
            // If they have no invoice, or the last invoice was created more than 30 days ago
            if (!lastInvoice || lastInvoice.createdAt < thirtyDaysAgo) {
                console.log(`Generating monthly invoice for tenant ${tenant.id}...`);
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 5);

                await prisma.tenantInvoice.create({
                    data: {
                        invoiceNumber: `INV-${Date.now()}-${tenant.id.substring(0, 4)}`,
                        tenantId: tenant.id,
                        planId: tenant.planId,
                        amount: tenant.plan.price,
                        dueDate: dueDate,
                        status: "PENDING"
                    }
                });
            }
        }

        // --- 3. SERVICE CONTROL LOGIC ---
        console.log("Checking for overdue invoices (Service Control)...");
        // Find ACTIVE tenants who have a PENDING invoice past its due date
        const overdueInvoices = await prisma.tenantInvoice.findMany({
            where: {
                status: "PENDING",
                dueDate: { lt: now },
                tenant: { status: "ACTIVE" }
            }
        });

        for (const invoice of overdueInvoices) {
            console.log(`Invoice ${invoice.invoiceNumber} is overdue! Suspending tenant ${invoice.tenantId}...`);
            await prisma.tenant.update({
                where: { id: invoice.tenantId },
                data: { status: "SUSPENDED" }
            });
        }

        console.log(`[${new Date().toISOString()}] Cron Jobs Completed Successfully.`);
    } catch (error) {
        console.error("Cron Job Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Execute the function
runCronJobs();
