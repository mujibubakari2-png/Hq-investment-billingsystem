import { getTenantClient } from "./tenantPrisma";
import prisma from "./prisma";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";


/**
 * RADIUS Synchronization Utility
 *
 * Manages the high-level RadiusUser model AND the low-level
 * FreeRADIUS tables (radcheck / radreply) used directly by FreeRADIUS.
 *
 * ARCHITECTURE:
 *  - radcheck  → attributes FreeRADIUS checks BEFORE granting access
 *                (MD5-Password, Expiration)
 *                RAD-002 FIX: Changed from Cleartext-Password to MD5-Password.
 *                FreeRADIUS pap module hashes the incoming PAP password with MD5
 *                and compares to stored hash — avoids plaintext passwords at rest
 *                in the database. Run the backfill migration below on existing rows.
 *  - radreply  → attributes FreeRADIUS sends back AFTER granting access
 *                (Session-Timeout, Mikrotik-Rate-Limit, etc.)
 *
 * Both tables must be populated for MikroTik to accept the session.
 *
 * CRIT-004 FIX: upsertRadCheck / upsertRadReply now use a single atomic
 *   prisma.$executeRaw() INSERT ... ON CONFLICT DO UPDATE statement.
 *   The previous findFirst → create pattern had a TOCTOU race condition:
 *   two concurrent webhook callbacks for the same user could both reach the
 *   create() branch simultaneously, causing a P2002 unique constraint error
 *   or silent data corruption. The ON CONFLICT approach is atomic at the DB
 *   level — only one write wins, no retry logic needed.
 */

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * CRIT-004 FIX: Atomic upsert for radcheck using raw SQL ON CONFLICT DO UPDATE.
 * Prisma's generated upsert() struggles with compound nullable unique keys
 * (username, tenantId, attribute) where tenantId can be NULL. Raw SQL handles
 * this correctly via the named unique index.
 */
async function upsertRadCheck(
    username: string,
    attribute: string,
    value: string,
    op: string,
    tenantId: string | null
) {
    const tid = tenantId || null;
    await prisma.$executeRaw`
        INSERT INTO radcheck (username, attribute, op, value, "tenantId")
        VALUES (${username}, ${attribute}, ${op}, ${value}, ${tid})
        ON CONFLICT (username, "tenantId", attribute)
        DO UPDATE SET value = EXCLUDED.value, op = EXCLUDED.op
    `;
}

/**
 * CRIT-004 FIX: Atomic upsert for radreply using raw SQL ON CONFLICT DO UPDATE.
 */
async function upsertRadReply(
    username: string,
    attribute: string,
    value: string,
    op: string,
    tenantId: string | null
) {
    const tid = tenantId || null;
    await prisma.$executeRaw`
        INSERT INTO radreply (username, attribute, op, value, "tenantId")
        VALUES (${username}, ${attribute}, ${op}, ${value}, ${tid})
        ON CONFLICT (username, "tenantId", attribute)
        DO UPDATE SET value = EXCLUDED.value, op = EXCLUDED.op
    `;
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

    const db = getTenantClient(tenantId);

    // ── 1. Manage RadiusUser (high-level tracking model) ─────────────────────
    const sessionTimeoutSecs = expiresAt
        ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
        : null;

    let radiusUser = await db.radiusUser.findFirst({
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
        radiusUser = await db.radiusUser.update({
            where: { id: radiusUser.id },
            data: updateData,
        });
    } else {
        if (!password) {
            throw new Error("[RADIUS] Cannot create RadiusUser without a password — password is required.");
        }
        radiusUser = await db.radiusUser.create({
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

    // ── 2. radcheck: MD5-Password (RAD-002 FIX — no longer Cleartext-Password) ─
    // FreeRADIUS pap module: hashes incoming password with MD5, compares to stored.
    // MD5 is intentionally used here — it is what FreeRADIUS pap expects;
    // bcrypt is NOT compatible with FreeRADIUS's PAP verification path.
    if (password) {
        const md5Hash = createHash('md5').update(password).digest('hex');
        await upsertRadCheck(username, "MD5-Password", md5Hash, ":=", tenantId);
        // Remove any legacy Cleartext-Password entry to prevent stale plaintext
        await deleteRadCheckAttribute(username, "Cleartext-Password", tenantId);
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
    if (sessionTimeoutSecs !== null && sessionTimeoutSecs > 0) {
        await upsertRadReply(username, "Session-Timeout", String(sessionTimeoutSecs), "=", tenantId);
    } else {
        await deleteRadReplyAttribute(username, "Session-Timeout", tenantId);
    }

    // ── 6. radreply: Mikrotik-Rate-Limit (bandwidth control) ─────────────────
    if (rateLimit) {
        await upsertRadReply(username, "Mikrotik-Rate-Limit", rateLimit, "=", tenantId);
    }

    // ── 7. radreply: Mikrotik-Group (Hotspot/PPPoE Profile) ──────────────────
    if (profileName) {
        await upsertRadReply(username, "Mikrotik-Group", profileName, "=", tenantId);
    } else {
        await deleteRadReplyAttribute(username, "Mikrotik-Group", tenantId);
    }

    return radiusUser;
}

/**
 * Suspend a user in RADIUS — immediately rejects all new auth attempts.
 */
export async function suspendRadiusUser(username: string, tenantId: string | null) {
    const db = getTenantClient(tenantId);

    // 1. Mark high-level model as Inactive
    await db.radiusUser.updateMany({
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
    const db = getTenantClient(tenantId);

    await Promise.allSettled([
        db.radCheck.deleteMany({ where: { username, tenantId } }),
        db.radReply.deleteMany({ where: { username, tenantId } }),
        db.radiusUser.deleteMany({ where: { username, tenantId } }),
    ]);
}
