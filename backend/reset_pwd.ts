import prisma from "./src/lib/prisma";
import { hashPassword } from "./src/lib/auth";

async function reset() {
    try {
        const email = "mujibubakari2@gmail.com";
        const password = "hq-admin-2026";
        const hashedPassword = await hashPassword(password);
        
        const user = await prisma.user.update({
            where: { email },
            data: { 
                password: hashedPassword,
                role: "SUPER_ADMIN",
                status: "ACTIVE",
                tenantId: null
            }
        });
        
        console.log(`Password reset for ${email} to ${password}`);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

reset();
