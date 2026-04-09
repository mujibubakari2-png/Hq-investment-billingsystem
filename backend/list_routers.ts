import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    console.log("--- Existing Routers ---");
    const routers = await prisma.router.findMany({
        take: 5
    });

    if (routers.length === 0) {
        console.log("No routers found. Please create a router first.");
    } else {
        routers.forEach(r => {
            console.log(`Router: ${r.name} (ID: ${r.id})`);
            console.log(`  Host: ${r.host}`);
            console.log(`  VPN Mode: ${r.vpnMode}`);
            console.log(`  WireGuard Status: ${r.wireguardStatus}`);
            console.log("---------------------------");
        });
    }

    await prisma.$disconnect();
}

main().catch(console.error);
