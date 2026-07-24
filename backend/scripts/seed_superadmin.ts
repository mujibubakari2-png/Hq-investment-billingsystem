import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  const hash = await bcrypt.hash("admin123", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@hqinvestment.com" },
    update: { password: hash, role: "SUPER_ADMIN", tenantId: null, status: "ACTIVE" },
    create: {
      username: "superadmin",
      email: "admin@hqinvestment.com",
      password: hash,
      fullName: "Platform Super Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      tenantId: null
    }
  });
  console.log("✅ Platform Super Admin Seeded Successfully:", user.email);
  await prisma.$disconnect();
  await pool.end();
}

seed().catch(console.error);
