/**
 * POST /api/auth/mfa/verify
 *
 * CRIT-002 FIX: MFA verification step during login.
 *
 * Flow:
 *   1. User submits password → /api/auth/login returns { mfaRequired: true, tempToken }
 *   2. User submits 6-digit TOTP code → this endpoint
 *   3. This endpoint verifies TOTP, then issues real accessToken + refreshToken cookies
 *
 * The tempToken is a short-lived (5min) JWT that only carries the userId
 * and a 'mfa_pending' claim — it cannot access protected routes.
 */

import { NextRequest } from 'next/server';
import { jsonResponse, errorResponse, signToken, signRefreshToken } from '@/lib/auth';
import { verifyMfaAtLogin } from '@/lib/mfa';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';

const TEMP_TOKEN_SECRET =
  (process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET ?? '') + '_mfa_pending';

function verifyTempToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, TEMP_TOKEN_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { tempToken?: string; code?: string };

  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { tempToken, code } = body;

  if (!tempToken || !code) {
    return errorResponse('tempToken and code are required', 400);
  }

  // Verify the temp token issued by /api/auth/login
  const decoded = verifyTempToken(tempToken);
  if (!decoded) {
    return errorResponse('MFA session expired. Please log in again.', 401);
  }

  // Verify the TOTP code (or backup code)
  const result = await verifyMfaAtLogin(decoded.userId, code.trim());

  if (result === 'invalid') {
    return errorResponse('Invalid MFA code. Please check your authenticator app.', 401);
  }

  if (result === 'no_mfa') {
    // Edge case: MFA was disabled between login and verify attempt
    return errorResponse('MFA is not configured for this account.', 400);
  }

  // MFA passed — load full user to build JWT payload
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      username: true,
      role: true,
      tenantId: true,
      email: true,
      status: true,
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    return errorResponse('Account is not active.', 403);
  }

  // Issue real access + refresh tokens
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenantId ?? null,
  };

  const accessToken  = signToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const response = jsonResponse({
    success: true,
    message: 'MFA verified successfully',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
    },
  });

  // Set HttpOnly cookies — same pattern as login route
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOpts = `HttpOnly; ${isProd ? 'Secure; ' : ''}SameSite=Strict; Path=/`;

  response.headers.append('Set-Cookie', `accessToken=${accessToken}; Max-Age=7200; ${cookieOpts}`);
  response.headers.append('Set-Cookie', `refreshToken=${refreshToken}; Max-Age=604800; ${cookieOpts}`);

  return response;
}
