
import "dotenv/config";
import prisma from "./src/lib/prisma";

async function main() {
    const pkgs = await prisma.package.findMany({ where: { status: "ACTIVE" } });
    console.log("ACTIVE PACKAGES:", JSON.stringify(pkgs, null, 2));
}

main();
