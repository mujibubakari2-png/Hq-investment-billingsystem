/**
 * POST /api/auth/mfa/setup
 *
 * Initiate MFA setup for the current user — returns QR code and backup codes.
 * The frontend renders the QR code; user scans it, then calls /api/auth/mfa/enable.
 */

import { NextRequest } from 'next/server';
import { requireAuth, jsonResponse, errorResponse } from '@/lib/auth';
import { generateMfaSetup } from '@/lib/mfa';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  let user;
  try {
    user = requireAuth(req);
  } catch {
    return errorResponse('Unauthorized', 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { email: true, mfaEnabled: true },
  });

  if (!dbUser) return errorResponse('User not found', 404);
  if (dbUser.mfaEnabled) return errorResponse('MFA is already enabled for this account', 409);

  const setup = await generateMfaSetup(dbUser.email);

  // Return setup info — do NOT persist the secret yet (user must confirm first)
  return jsonResponse({
    secret:      setup.secret,      // Show for manual entry fallback
    qrDataUrl:   setup.qrDataUrl,   // Render as <img src={qrDataUrl} />
    backupCodes: setup.backupCodes, // Show ONCE — user must save these
  });
}
