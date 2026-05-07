import prisma from "./prisma";

/**
 * RADIUS Synchronization Utility
 * 
 * Manages the high-level RadiusUser model and the low-level 
 * RadCheck/RadReply tables used by FreeRADIUS.
 */

export async function syncRadiusUser(params: {
    username: string;
    password?: string;
    tenantId: string | null;
    fullName?: string;
    expiresAt?: Date;
    status?: "Active" | "Inactive";
}) {
    const { username, password, tenantId, fullName, expiresAt, status } = params;

    // 1. Manage RadiusUser (High-level model)
    const radiusUser = await prisma.radiusUser.upsert({
        where: { 
            username_tenantId: { username, tenantId: tenantId || "" } 
        },
        update: {
            ...(password ? { password } : {}),
            ...(fullName ? { fullName } : {}),
            ...(status ? { status } : {}),
            ...(expiresAt ? { sessionTimeout: String(Math.floor((expiresAt.getTime() - Date.now()) / 1000)) } : {}),
        },
        create: {
            username,
            password: password || "123456",
            tenantId,
            fullName: fullName || null,
            status: status || "Active",
            sessionTimeout: expiresAt ? String(Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : null,
        },
    });

    // 2. Manage RadCheck (Low-level table for Cleartext-Password)
    if (password) {
        await prisma.radCheck.upsert({
            where: { 
                // Note: radcheck doesn't have a unique constraint on username_tenantId in schema, 
                // but we should manage it as unique. We use findFirst + create/update.
                id: (await prisma.radCheck.findFirst({ 
                    where: { username, tenantId, attribute: "Cleartext-Password" } 
                }))?.id || -1
            },
            update: { value: password },
            create: {
                username,
                value: password,
                attribute: "Cleartext-Password",
                op: ":=",
                tenantId,
            },
        });
    }

    // 3. Manage Expiration (Expiration attribute in RadCheck)
    if (expiresAt) {
        // FreeRADIUS 'Expiration' format: "Jan 01 2024 00:00:00"
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const expStr = `${months[expiresAt.getMonth()]} ${String(expiresAt.getDate()).padStart(2, '0')} ${expiresAt.getFullYear()} ${String(expiresAt.getHours()).padStart(2, '0')}:${String(expiresAt.getMinutes()).padStart(2, '0')}:${String(expiresAt.getSeconds()).padStart(2, '0')}`;
        
        await prisma.radCheck.upsert({
            where: { 
                id: (await prisma.radCheck.findFirst({ 
                    where: { username, tenantId, attribute: "Expiration" } 
                }))?.id || -1
            },
            update: { value: expStr },
            create: {
                username,
                value: expStr,
                attribute: "Expiration",
                op: ":=",
                tenantId,
            },
        });
    }

    return radiusUser;
}

/**
 * Suspend a user in RADIUS
 */
export async function suspendRadiusUser(username: string, tenantId: string | null) {
    await prisma.radiusUser.updateMany({
        where: { username, tenantId },
        data: { status: "Inactive" }
    });
    
    // Set an expiration in the past to immediately reject
    const past = new Date(Date.now() - 86400000);
    await syncRadiusUser({ username, tenantId, status: "Inactive", expiresAt: past });
}
