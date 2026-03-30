import { PrismaClient } from "./src/generated/prisma/index.js";

const prisma = new PrismaClient({});

async function main() {
    try {
        const usersToUpdate = ["Hqbakari@gmail.com", "keemuu414@gmail.com"];
        
        console.log(`Updating roles for: ${usersToUpdate.join(", ")}`);
        
        const result = await prisma.user.updateMany({
            where: {
                email: { in: usersToUpdate },
                role: "SUPER_ADMIN"
            },
            data: {
                role: "ADMIN"
            }
        });
        
        console.log(`Updated ${result.count} users to ADMIN role.`);
        
    } catch (error) {
        console.error("Error updating users:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
