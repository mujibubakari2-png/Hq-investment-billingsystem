import { PrismaClient } from './src/generated/prisma/client';

const prisma = new PrismaClient();

async function fixStuckTenants() {
  console.log("Checking for stuck tenants with PAID invoices...");

  const tenants = await prisma.tenant.findMany({
    include: {
      tenantInvoices: true
    }
  });

  let fixedCount = 0;

  for (const tenant of tenants) {
    // If tenant is still SUSPENDED or PENDING_APPROVAL, but has an invoice marked PAID
    // that did not update the expiresAt date correctly.
    if (tenant.status !== 'ACTIVE') {
      const hasPaid = tenant.tenantInvoices.some(inv => inv.status === 'PAID');
      
      if (hasPaid) {
        console.log(`Fixing tenant ${tenant.name} (${tenant.id})`);
        
        const now = new Date();
        const startOfNextMonth = new Date();
        startOfNextMonth.setMonth(startOfNextMonth.getMonth() + 1);

        // Figure out how many months they paid for. Add up all packageMonths of PAID invoices.
        let totalPaidMonths = 0;
        for (const inv of tenant.tenantInvoices.filter(i => i.status === 'PAID')) {
           totalPaidMonths += (inv.packageMonths || 1);
        }

        // If their current limit expired, renew from today for that many months
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
        console.log(` -> Restored status to ACTIVE and updated license expiration.`);
      }
    } else {
        // Also fix any active ones whose license hasn't been extended but they paid.
        const paidInvoices = tenant.tenantInvoices.filter(i => i.status === 'PAID');
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

  console.log(`\nFinished fixing tenants. Total fixed: ${fixedCount}`);
}

fixStuckTenants()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
