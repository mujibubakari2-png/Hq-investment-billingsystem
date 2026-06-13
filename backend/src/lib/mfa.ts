/**
 * MFA (Multi-Factor Authentication) — TOTP Library
 *
 * CRIT-002 FIX: Provides TOTP-based MFA compatible with Google Authenticator,
 * Authy, and any RFC 6238 compliant authenticator app.
 *
 * Uses otplib v13 functional API: generateSecret, generateURI, verifySync.
 *
 * Flow:
 *   1. User enables MFA in Profile settings → calls /api/auth/mfa/setup
 *   2. Server generates a TOTP secret, returns QR code + backup codes
 *   3. User scans QR code with authenticator app
 *   4. User confirms with a 6-digit code → /api/auth/mfa/enable
 *   5. On future logins: password OK → MFA challenge → JWT issued on pass
 *
 * Dependencies: otplib@13, qrcode
 * Install: pnpm --filter backend add otplib qrcode @types/qrcode
 */

import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { encrypt, decrypt } from '@/lib/encryption';
import prisma from '@/lib/prisma';

// ── Constants ────────────────────────────────────────────────────────────────

const APP_NAME = process.env.APP_NAME ?? 'HQ Investment ISP';

/** Clock tolerance: accept codes 1 step before/after current window (±30s) */
const TOTP_EPOCH_TOLERANCE = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MfaSetupResult {
  /** Raw Base32 secret — show to user ONCE for manual entry fallback */
  secret: string;
  /** otpauth:// URI for QR code generation */
  otpauthUrl: string;
  /** Base64 PNG QR code data URL — render as <img src={qrDataUrl} /> */
  qrDataUrl: string;
  /** 8 one-time backup codes — show ONCE, user must save these */
  backupCodes: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate 8 one-time backup codes (in case authenticator is lost).
 * Format: XXXX-XXXX (easy to read and type). Returns plaintext — caller hashes before storage.
 */
function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = Math.random().toString(36).slice(2, 6).toUpperCase();
    const part2 = Math.random().toString(36).slice(2, 6).toUpperCase();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a new TOTP secret for a user.
 * Returns the QR code and backup codes for display — does NOT persist anything.
 * Call enableMfa() after the user confirms with a valid code.
 */
export async function generateMfaSetup(email: string): Promise<MfaSetupResult> {
  // otplib v13: generateSecret() returns a Base32-encoded random secret
  const secret = generateSecret({ length: 20 });

  // generateURI() builds the otpauth:// URI for QR scanning
  const otpauthUrl = generateURI({
    issuer: APP_NAME,
    label: email,
    secret,
    digits: 6,
    period: 30,
  });

  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  const backupCodes = generateBackupCodes(8);

  return { secret, otpauthUrl, qrDataUrl, backupCodes };
}

/**
 * Verify a TOTP token against a plaintext secret (synchronous).
 * Used both during setup confirmation and at login.
 */
export function verifyMfaToken(token: string, secret: string): boolean {
  try {
    // otplib v13: verifySync returns { valid, delta? }
    const result = verifySync({
      token: token.replace(/\s/g, ''),
      secret,
      epochTolerance: TOTP_EPOCH_TOLERANCE,
    });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Enable MFA for a user after they confirm setup with a valid TOTP code.
 * Encrypts the secret before storing; hashes backup codes with bcrypt.
 *
 * @param userId       - User's DB id
 * @param plainSecret  - Raw TOTP secret from generateMfaSetup()
 * @param token        - 6-digit code user entered to confirm setup
 * @param backupCodes  - Plaintext backup codes from generateMfaSetup()
 * @returns true on success, false if token doesn't match
 */
export async function enableMfa(
  userId: string,
  plainSecret: string,
  token: string,
  backupCodes: string[]
): Promise<boolean> {
  // Confirm the user actually set up their authenticator correctly
  if (!verifyMfaToken(token, plainSecret)) {
    return false;
  }

  const encryptedSecret = encrypt(plainSecret)!;

  // Hash each backup code separately (bcrypt, run in parallel)
  const bcrypt = await import('bcryptjs');
  const hashedBackupCodes = await Promise.all(
    backupCodes.map((code) => bcrypt.hash(code, 10))
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptedSecret,
      mfaEnabled: true,
      mfaBackupCodes: hashedBackupCodes,
    },
  });

  return true;
}

/**
 * Disable MFA for a user (e.g., when they lose their authenticator).
 * Requires re-verification — never disable without confirming identity first.
 */
export async function disableMfa(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: null,
      mfaEnabled: false,
      mfaBackupCodes: [],
    },
  });
}

/**
 * Verify a TOTP code at login time.
 * Fetches the encrypted secret from DB, decrypts, and checks the token.
 *
 * @returns 'valid' | 'invalid' | 'no_mfa' (MFA not enabled for this user)
 */
export async function verifyMfaAtLogin(
  userId: string,
  token: string
): Promise<'valid' | 'invalid' | 'no_mfa'> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
  });

  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return 'no_mfa';
  }

  const plainSecret = decrypt(user.mfaSecret);
  if (!plainSecret) return 'invalid';

  // Check TOTP token first
  if (verifyMfaToken(token, plainSecret)) {
    return 'valid';
  }

  // Check backup codes (one-time use)
  const bcrypt = await import('bcryptjs');
  const cleanToken = token.replace(/\s/g, '').toUpperCase();

  for (let i = 0; i < user.mfaBackupCodes.length; i++) {
    const hash = user.mfaBackupCodes[i];
    if (await bcrypt.compare(cleanToken, hash)) {
      // Consume the used backup code — remove it from the array
      const remainingCodes = user.mfaBackupCodes.filter(
        (_: string, idx: number) => idx !== i
      );
      await prisma.user.update({
        where: { id: userId },
        data: { mfaBackupCodes: remainingCodes },
      });
      return 'valid';
    }
  }

  return 'invalid';
}
