/**
 * POST /api/auth/mfa/disable
 *
 * Disable MFA for the current user.
 * Requires re-verification of password for security.
 */

import { NextRequest } from 'next/server';
import { requireAuth, jsonResponse, errorResponse, comparePassword } from '@/lib/auth';
import { disableMfa } from '@/lib/mfa';
import { getTenantClient } from '@/lib/tenantPrisma';

export async function POST(req: NextRequest) {
  let user;
  try {
    user = requireAuth(req);
  } catch {
    return errorResponse('Unauthorized', 401);
  }

  const db = getTenantClient(user);

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!body.password) {
    return errorResponse('Password is required to disable MFA', 400);
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.userId },
    select: { password: true, mfaEnabled: true },
  });

  if (!dbUser) return errorResponse('User not found', 404);
  if (!dbUser.mfaEnabled) return errorResponse('MFA is not enabled for this account', 400);

  // Re-verify password before allowing MFA disable
  const passwordValid = await comparePassword(body.password, dbUser.password);
  if (!passwordValid) {
    return errorResponse('Incorrect password', 401);
  }

  await disableMfa(user.userId);

  return jsonResponse({
    success: true,
    message: 'MFA has been disabled. Your account is now protected by password only.',
  });
}
