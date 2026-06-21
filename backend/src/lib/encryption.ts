/**
 * Field-Level Encryption Utility
 *
 * Encrypts sensitive fields before storing in DB (router passwords,
 * payment API keys, WireGuard private keys, VPN user passwords) and decrypts on read.
 *
 * Algorithm: AES-256-GCM (authenticated encryption — detects tampering)
 * Key source: FIELD_ENCRYPTION_KEY env var (32-byte hex string)
 *
 * Setup:
 *   1. Generate a key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   2. Add to .env: FIELD_ENCRYPTION_KEY=<your-64-char-hex-string>
 *   3. Run a one-time migration script to encrypt existing plaintext values.
 *
 * Encrypted format: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Plaintext values (not yet migrated) pass through transparently.
 */

import crypto from 'crypto';

const ALGORITHM   = 'aes-256-gcm';
const IV_LENGTH   = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH  = 16;
const PREFIX      = 'enc:v1:';

function getKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'FATAL: FIELD_ENCRYPTION_KEY is required in all environments. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (hex.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string. Returns an "enc:v1:..." prefixed string.
 * Safe to call on already-encrypted values (idempotent).
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return plaintext ?? null;
  if (plaintext.startsWith(PREFIX)) return plaintext; // already encrypted

  const key = getKey();
  const iv  = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an "enc:v1:..." string back to plaintext.
 * Returns plaintext values unchanged (backward-compatible with unmigrated rows).
 */
export function decrypt(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  if (!value.startsWith(PREFIX)) return value; // not encrypted yet — pass through

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format.');

  const [ivHex, tagHex, ciphertextHex] = parts;
  const key        = getKey();
  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

/** Returns true if the value is already encrypted */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value?.startsWith(PREFIX);
}

/**
 * Encrypt a Router record's sensitive fields before saving to DB.
 */
export function encryptRouterFields<T extends {
  password?: string | null;
  wgPrivateKey?: string | null;
  wgPresharedKey?: string | null;
}>(data: T): T {
  return {
    ...data,
    ...(data.password      !== undefined && { password:      encrypt(data.password)      }),
    ...(data.wgPrivateKey  !== undefined && { wgPrivateKey:  encrypt(data.wgPrivateKey)  }),
    ...(data.wgPresharedKey!== undefined && { wgPresharedKey:encrypt(data.wgPresharedKey)}),
  };
}

/**
 * Decrypt a Router record's sensitive fields after reading from DB.
 */
export function decryptRouterFields<T extends {
  password?: string | null;
  wgPrivateKey?: string | null;
  wgPresharedKey?: string | null;
}>(router: T): T {
  return {
    ...router,
    password:       decrypt(router.password),
    wgPrivateKey:   decrypt(router.wgPrivateKey),
    wgPresharedKey: decrypt(router.wgPresharedKey),
  };
}

/**
 * Encrypt a PaymentChannel record's sensitive fields before saving.
 */
export function encryptPaymentChannelFields<T extends {
  apiKey?: string | null;
  apiSecret?: string | null;
  webhookSecret?: string | null;
}>(data: T): T {
  return {
    ...data,
    ...(data.apiKey       !== undefined && { apiKey:       encrypt(data.apiKey)       }),
    ...(data.apiSecret    !== undefined && { apiSecret:    encrypt(data.apiSecret)    }),
    ...(data.webhookSecret!== undefined && { webhookSecret:encrypt(data.webhookSecret)}),
  };
}

/**
 * Decrypt a PaymentChannel record's sensitive fields after reading.
 */
export function decryptPaymentChannelFields<T extends {
  apiKey?: string | null;
  apiSecret?: string | null;
  webhookSecret?: string | null;
}>(channel: T): T {
  return {
    ...channel,
    apiKey:        decrypt(channel.apiKey),
    apiSecret:     decrypt(channel.apiSecret),
    webhookSecret: decrypt(channel.webhookSecret),
  };
}

// ── DB-004 FIX: VPN User password encryption ──────────────────────────────────
//
// VpnUser.password was previously stored in plaintext. A database dump would
// expose all VPN credentials. Now encrypted with the same AES-256-GCM scheme.

/**
 * Encrypt a VpnUser record's sensitive fields before saving to DB.
 */
export function encryptVpnUserFields<T extends {
  password?: string | null;
}>(data: T): T {
  return {
    ...data,
    ...(data.password !== undefined && { password: encrypt(data.password) }),
  };
}

/**
 * Decrypt a VpnUser record's sensitive fields after reading from DB.
 */
export function decryptVpnUserFields<T extends {
  password?: string | null;
}>(vpnUser: T): T {
  return {
    ...vpnUser,
    password: decrypt(vpnUser.password),
  };
}
