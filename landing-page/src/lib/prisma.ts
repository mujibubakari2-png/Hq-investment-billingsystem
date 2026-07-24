/**
 * Prisma client singleton for the landing-page service.
 * Connects to the same PostgreSQL database as the backend.
 * The backend's generated client is referenced via a relative path.
 */

// We import from the backend's generated prisma output which both services share.
// In production, ensure DATABASE_URL is set in landing-page/.env
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
