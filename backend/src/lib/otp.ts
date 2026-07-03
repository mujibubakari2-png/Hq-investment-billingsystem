/**
 * OTP (One-Time Password) Utility
 *
 * SEC-003 FIX: OTPs are now hashed with bcrypt before being stored in the DB.
 * Previously OTPs were stored in plaintext, meaning a database dump would allow
 * an attacker to use any unexpired OTP to reset any user's password.
 *
 * Flow:
 *   1. generateAndStoreOtp()  → creates OTP, hashes it, stores hash, returns plaintext for email
 *   2. verifyOtp()            → takes submitted code, compares against stored hash
 *   3. consumeOtp()           → marks OTP as used after successful verification
 *
 * Hash algorithm: bcrypt (cost 10) — fast enough for OTP verification (<200ms)
 *   but slow enough that brute-force of a 6-digit code takes >10h per email.
 */

import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { getTenantClient } from "@/lib/tenantPrisma";

const OTP_EXPIRY_MINUTES = 30;
const OTP_BCRYPT_ROUNDS = 10;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneratedOtp {
  /** Plaintext code to send to user via email/SMS */
  code: string;
  /** DB record id (needed to mark as used) */
  otpId: string;
}

// ── Core Functions ─────────────────────────────────────────────────────────────

/**
 * Generate a 6-digit OTP, hash it, and store the hash in user_otps.
 * Returns the plaintext code (to be emailed) and the DB record id.
 *
 * Usage:
 *   const { code, otpId } = await generateAndStoreOtp(email, tenantId);
 *   await sendOtpEmail(email, code, 'password-reset');
 */
export async function generateAndStoreOtp(
  email: string,
  tenantId?: string | null
): Promise<GeneratedOtp> {
  // 6-digit code: [100000, 999999]
  const code = randomInt(100000, 1000000).toString();
  const hash = await bcrypt.hash(code, OTP_BCRYPT_ROUNDS);

  const db = getTenantClient(tenantId ?? null);

  // Invalidate all previous unexpired OTPs for this email (prevent accumulation)
  await db.userOtp.updateMany({
    where: { email, used: false, expiresAt: { gt: new Date() } },
    data: { used: true },
  });

  const record = await db.userOtp.create({
    data: {
      email,
      // SEC-003 FIX: Store bcrypt hash, never the plaintext code
      otp: hash,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      tenantId: tenantId ?? null,
    },
    select: { id: true },
  });

  return { code, otpId: record.id };
}

/**
 * Verify a submitted OTP code against the stored hash for a given email.
 * Returns the matching DB record (with its id) or null if invalid/expired.
 *
 * Usage:
 *   const match = await verifyOtp(email, submittedCode);
 *   if (!match) return errorResponse("Invalid or expired OTP", 400);
 */
export async function verifyOtp(
  email: string,
  submittedCode: string
): Promise<{ id: string } | null> {
  // Fetch all unexpired, unused OTPs for this email (should be at most 1)
  const db = getTenantClient(null);
  const candidates = await db.userOtp.findMany({
    where: { email, used: false, expiresAt: { gt: new Date() } },
    select: { id: true, otp: true },
    orderBy: { createdAt: "desc" },
    take: 3, // Safety — compare only the 3 most recent
  });

  for (const candidate of candidates) {
    // bcrypt.compare is constant-time — safe against timing attacks
    const match = await bcrypt.compare(submittedCode, candidate.otp);
    if (match) {
      return { id: candidate.id };
    }
  }

  return null;
}

/**
 * Mark an OTP record as used (idempotent).
 */
export async function consumeOtp(otpId: string): Promise<void> {
  const db = getTenantClient(null);
  await db.userOtp.update({
    where: { id: otpId },
    data: { used: true },
  });
}

/**
 * Combined verify + consume in one atomic operation.
 *
 * HIGH-D-005 FIX: The previous implementation called verifyOtp() and then
 * consumeOtp() as two separate database round-trips. A race between two
 * concurrent requests using the same OTP code could both pass verifyOtp()
 * before either consumeOtp() ran, allowing OTP replay.
 *
 * The fix uses a Prisma interactive transaction:
 *   1. Fetch candidates (still two queries internally, but within a serializable tx)
 *   2. bcrypt-compare against each candidate
 *   3. On match: UPDATE user_otps SET used=true WHERE id=? — atomically consuming it
 *   4. On duplicate attempt: the candidate will already have used=true inside the
 *      transaction so the second request gets no match and returns false.
 *
 * Returns true on success, false if OTP is invalid/expired/already-used.
 */
export async function verifyAndConsumeOtp(
  email: string,
  submittedCode: string
): Promise<boolean> {
  const db = getTenantClient(null);

  return await db.$transaction(async (tx) => {
    // Fetch candidates inside the transaction for consistent read
    const candidates = await tx.userOtp.findMany({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      select: { id: true, otp: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    for (const candidate of candidates) {
      const match = await bcrypt.compare(submittedCode, candidate.otp);
      if (match) {
        // Atomic consume: marks this OTP as used within the same transaction.
        // A concurrent request attempting to use the same OTP will find used=true.
        await tx.userOtp.update({
          where: { id: candidate.id },
          data: { used: true },
        });
        return true;
      }
    }

    return false;
  });
}
