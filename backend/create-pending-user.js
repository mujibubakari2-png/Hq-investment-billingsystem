const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const tenant = await prisma.tenant.create({
    data: {
      name: "Pending Agency Ltd",
      email: "waiting@example.com",
      phone: "+255123456789",
      status: "PENDING_APPROVAL",
      planId: "plan_premium"
    }
  });

  const user = await prisma.user.create({
    data: {
      fullName: "Waiting User",
      email: "waiting@example.com",
      username: "waiting@example.com",
      phone: "+255123456789",
      password: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
      tenantId: tenant.id
    }
  });

  console.log("Created PENDING_APPROVAL user:", user.email);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
