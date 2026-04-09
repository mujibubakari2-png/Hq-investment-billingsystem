import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
     await prisma.tenant.update({
        where: { id: tenant.id },
        data: { licenseExpiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'ACTIVE' }
     });
     console.log("Tenant license backdated to 5 days ago: " + tenant.name);
  } else {
     console.log("No tenant found");
  }
}
main().finally(() => prisma.$disconnect());
