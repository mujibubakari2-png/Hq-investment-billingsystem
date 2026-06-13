/**
 * POST /api/auth/mfa/enable
 *
 * Confirm and activate MFA after the user has scanned the QR code.
 * The user submits the TOTP secret from setup + a live 6-digit code to confirm.
 */

import { NextRequest } from 'next/server';
import { requireAuth, jsonResponse, errorResponse } from '@/lib/auth';
import { enableMfa } from '@/lib/mfa';

export async function POST(req: NextRequest) {
  let user;
  try {
    user = requireAuth(req);
  } catch {
    return errorResponse('Unauthorized', 401);
  }

  let body: { secret?: string; code?: string; backupCodes?: string[] };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const { secret, code, backupCodes } = body;

  if (!secret || !code || !backupCodes?.length) {
    return errorResponse('secret, code, and backupCodes are required', 400);
  }

  const success = await enableMfa(user.userId, secret, code, backupCodes);

  if (!success) {
    return errorResponse('Invalid TOTP code. Please ensure your authenticator app is set up correctly.', 400);
  }

  return jsonResponse({
    success: true,
    message: 'MFA has been enabled successfully. Keep your backup codes in a safe place.',
  });
}
