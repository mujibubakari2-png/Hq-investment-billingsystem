import prisma from "./prisma";

/**
 * RADIUS Synchronization Utility
 *
 * Manages the high-level RadiusUser model AND the low-level
 * FreeRADIUS tables (radcheck / radreply) used directly by FreeRADIUS.
 *
 * ARCHITECTURE:
 *  - radcheck  → attributes FreeRADIUS checks BEFORE granting access
 *                (Cleartext-Password, Expiration)
 *  - radreply  → attributes FreeRADIUS sends back AFTER granting access
 *                (Session-Timeout, Mikrotik-Rate-Limit, etc.)
 *
 * Both tables must be populated for MikroTik to accept the session.
 *
 * E08 FIX: All upserts now use `tenantId: tenantId || null` (not `|| ""`)
 *          to avoid DB constraint errors when tenantId is absent.
 * E16 FIX: upsertRadCheck / upsertRadReply now use prisma.upsert() with a
 *          unique compound key, eliminating the findFirst → create/update
 *          race condition under high concurrency.
 *          Requires a unique constraint: @@unique([username, tenantId, attribute])
 *          on both RadCheck and RadReply models in schema.prisma.
 */

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function upsertRadCheck(
    username: string,
    attribute: string,
    value: string,
    op: string,
    tenantId: string | null
) {
    // RAD-001 FIX: Wrap create() in try/catch to handle the findFirst→create race condition.
    // Under concurrent payment webhooks for the same user, two goroutines may both reach
    // the create() branch simultaneously, causing a unique constraint violation.
    // On conflict: fall back to update by re-querying the now-existing row.
    const existing = await prisma.radCheck.findFirst({
        where: { username, attribute, tenantId: tenantId || null },
    });

    if (existing) {
        await prisma.radCheck.update({
            where: { id: existing.id },
            data: { value, op },
        });
    } else {
        try {
            await prisma.radCheck.create({
                data: {
                    username,
                    attribute,
                    op,
                    value,
                    tenantId: tenantId || null,
                },
            });
        } catch (err: any) {
            // P2002 = Prisma unique constraint violation — race condition, row created concurrently
            if (err?.code === 'P2002') {
                const race = await prisma.radCheck.findFirst({
                    where: { username, attribute, tenantId: tenantId || null },
                });
                if (race) {
                    await prisma.radCheck.update({ where: { id: race.id }, data: { value, op } });
                }
            } else {
                throw err;
            }
        }
    }
}

async function upsertRadReply(
    username: string,
    attribute: string,
    value: string,
    op: string,
    tenantId: string | null
) {
    // RAD-001 FIX: Same race-condition guard as upsertRadCheck above.
    const existing = await prisma.radReply.findFirst({
        where: { username, attribute, tenantId: tenantId || null },
    });

    if (existing) {
        await prisma.radReply.update({
            where: { id: existing.id },
            data: { value, op },
        });
    } else {
        try {
            await prisma.radReply.create({
                data: {
                    username,
                    attribute,
                    op,
                    value,
                    tenantId: tenantId || null,
                },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                const race = await prisma.radReply.findFirst({
                    where: { username, attribute, tenantId: tenantId || null },
                });
                if (race) {
                    await prisma.radReply.update({ where: { id: race.id }, data: { value, op } });
                }
            } else {
                throw err;
            }
        }
    }
}

async function deleteRadReplyAttribute(
    username: string,
    attribute: string,
    tenantId: string | null
) {
    await prisma.radReply.deleteMany({
        where: { username, tenantId, attribute },
    });
}

async function deleteRadCheckAttribute(
    username: string,
    attribute: string,
    tenantId: string | null
) {
    await prisma.radCheck.deleteMany({
        where: { username, tenantId, attribute },
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function syncRadiusUser(params: {
    username: string;
    password?: string;
    tenantId: string | null;
    fullName?: string;
    expiresAt?: Date;
    status?: "Active" | "Inactive";
    /** e.g. "10M/20M" upload/download — becomes Mikrotik-Rate-Limit reply attribute */
    rateLimit?: string;
    /** The MikroTik profile name, becomes Mikrotik-Group reply attribute */
    profileName?: string;
    /** Allow simultaneous logins (default 1) */
    simultaneousUse?: number;
}) {
    const { username, password, tenantId, fullName, expiresAt, status, rateLimit, profileName, simultaneousUse } = params;

    // ── 1. Manage RadiusUser (high-level tracking model) ──────────────────────
    const sessionTimeoutSecs = expiresAt
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : null;

    // E08 FIX: We use findFirst + create/update instead of upsert because Prisma's
    // generated type for the unique compound index strictly demands a string for tenantId,
    // which prevents us from cleanly passing `null` in an upsert's where clause.
    let radiusUser = await prisma.radiusUser.findFirst({
        where: { username, tenantId: tenantId || null },
    });

    const updateData = {
        ...(password ? { password } : {}),
        ...(fullName ? { fullName } : {}),
        ...(status ? { status } : {}),
        ...(sessionTimeoutSecs !== null
            ? { sessionTimeout: String(sessionTimeoutSecs) }
            : {}),
    };

    if (radiusUser) {
        radiusUser = await prisma.radiusUser.update({
            where: { id: radiusUser.id },
            data: updateData,
        });
    } else {
        if (!password) {
            throw new Error("[RADIUS] Cannot create RadiusUser without a password — password is required.");
        }
        radiusUser = await prisma.radiusUser.create({
            data: {
                username,
                password,
                tenantId: tenantId || null,
                fullName: fullName || null,
                status: status || "Active",
                sessionTimeout: sessionTimeoutSecs !== null ? String(sessionTimeoutSecs) : null,
            },
        });
    }

    // ── 2. radcheck: Cleartext-Password ───────────────────────────────────────
    if (password) {
        await upsertRadCheck(username, "Cleartext-Password", password, ":=", tenantId);
    }

    // ── 3. radcheck: Simultaneous-Use (prevents multi-login abuse) ────────────
    const maxSessions = simultaneousUse ?? 1;
    await upsertRadCheck(username, "Simultaneous-Use", String(maxSessions), ":=", tenantId);

    // ── 4. radcheck: Expiration (FreeRADIUS rejects if date passed) ───────────
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (expiresAt) {
        const expStr = `${months[expiresAt.getMonth()]} ${String(expiresAt.getDate()).padStart(2, "0")} ${expiresAt.getFullYear()} ${String(expiresAt.getHours()).padStart(2, "0")}:${String(expiresAt.getMinutes()).padStart(2, "0")}:${String(expiresAt.getSeconds()).padStart(2, "0")}`;
        await upsertRadCheck(username, "Expiration", expStr, ":=", tenantId);
    }

    // ── 5. radreply: Session-Timeout (CRITICAL for MikroTik) ─────────────────
    //    MikroTik uses Session-Timeout to know when to disconnect the user.
    //    Without this, MikroTik may refuse to fully establish the session.
    if (sessionTimeoutSecs !== null && sessionTimeoutSecs > 0) {
        await upsertRadReply(username, "Session-Timeout", String(sessionTimeoutSecs), "=", tenantId);
    } else {
        // Remove stale Session-Timeout if subscription expired or no expiry
        await deleteRadReplyAttribute(username, "Session-Timeout", tenantId);
    }

    // ── 6. radreply: Mikrotik-Rate-Limit (bandwidth control) ─────────────────
    //    Format: "upload/download" e.g. "10M/20M"
    //    FreeRADIUS passes this to MikroTik which applies a queue tree.
    if (rateLimit) {
        await upsertRadReply(username, "Mikrotik-Rate-Limit", rateLimit, "=", tenantId);
    }

    // ── 7. radreply: Mikrotik-Group (Hotspot/PPPoE Profile) ──────────────────
    //    FreeRADIUS passes this to MikroTik which assigns the matching profile.
    if (profileName) {
        await upsertRadReply(username, "Mikrotik-Group", profileName, "=", tenantId);
    } else {
        await deleteRadReplyAttribute(username, "Mikrotik-Group", tenantId);
    }

    return radiusUser;
}

/**
 * Suspend a user in RADIUS — immediately rejects all new auth attempts.
 * Sets Expiration to the past in radcheck AND removes Session-Timeout
 * from radreply so any cached session also expires.
 */
export async function suspendRadiusUser(username: string, tenantId: string | null) {
    // 1. Mark high-level model as Inactive
    await prisma.radiusUser.updateMany({
        where: { username, tenantId },
        data: { status: "Inactive" },
    });

    // 2. Set Expiration in the past → FreeRADIUS rejects immediately
    const past = new Date(Date.now() - 86400000); // yesterday
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const expStr = `${months[past.getMonth()]} ${String(past.getDate()).padStart(2, "0")} ${past.getFullYear()} 00:00:00`;
    await upsertRadCheck(username, "Expiration", expStr, ":=", tenantId);

    // 3. Remove Session-Timeout from radreply → no valid session time
    await deleteRadReplyAttribute(username, "Session-Timeout", tenantId);
}

/**
 * Fully remove a user from all RADIUS tables.
 * Call this when a client is deleted or permanently banned.
 */
export async function deleteRadiusUser(username: string, tenantId: string | null) {
    await Promise.allSettled([
        prisma.radCheck.deleteMany({ where: { username, tenantId } }),
        prisma.radReply.deleteMany({ where: { username, tenantId } }),
        prisma.radiusUser.deleteMany({ where: { username, tenantId } }),
    ]);
}
