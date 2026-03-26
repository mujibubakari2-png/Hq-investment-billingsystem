import { PrismaClient } from "./src/generated/prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
prisma.$connect()
  .then(() => {
    console.log("SUCCESSFULLY CONNECTED TO DB");
    process.exit(0);
  })
  .catch((e) => {
    console.error("PRISMA CONNECTION ERROR:");
    console.error(e);
    process.exit(1);
  });
