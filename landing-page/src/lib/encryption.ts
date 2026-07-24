import crypto from 'crypto';

const ALGORITHM   = 'aes-256-gcm';
const IV_LENGTH   = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH  = 16;
const PREFIX      = 'enc:v1:';

function getKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'FATAL: FIELD_ENCRYPTION_KEY is required in all environments.'
    );
  }
  if (hex.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
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
